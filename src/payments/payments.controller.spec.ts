import {
  BadRequestException,
  NotFoundException,
  type RawBodyRequest,
  RequestMethod,
  UnauthorizedException,
} from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import { type Request } from 'express';
import {
  Order,
  PaymentMethod,
  PaymentStatus,
} from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { User } from '../users/entities/user.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let ordersService: { findOne: jest.Mock; markAsProcessing: jest.Mock };
  let paymentsService: {
    createPaymentIntent: jest.Mock;
    handleWebhook: jest.Mock;
  };

  const buildUser = (): User => ({ id: faker.string.uuid() }) as User;

  const buildOrder = (owner: User, overrides: Partial<Order> = {}): Order =>
    ({
      id: faker.string.uuid(),
      user: { id: owner.id },
      paymentStatus: PaymentStatus.PENDING,
      ...overrides,
    }) as unknown as Order;

  const buildWebhookRequest = (rawBody?: Buffer) =>
    ({ rawBody }) as unknown as RawBodyRequest<Request>;

  beforeEach(async () => {
    ordersService = {
      findOne: jest.fn(),
      markAsProcessing: jest.fn().mockResolvedValue(undefined),
    };
    paymentsService = {
      createPaymentIntent: jest.fn(),
      handleWebhook: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: OrdersService, useValue: ordersService },
        { provide: PaymentsService, useValue: paymentsService },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('routing', () => {
    it('should be mounted under /payments', () => {
      expect(Reflect.getMetadata(PATH_METADATA, PaymentsController)).toBe(
        'payments',
      );
    });

    it('should expose POST /payments/orders/:orderId/pay', () => {
      const handler = PaymentsController.prototype.createPaymentIntent;

      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
        'orders/:orderId/pay',
      );
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
        RequestMethod.POST,
      );
    });

    it('should expose POST /payments/webhook that answers with HTTP 200', () => {
      const handler = PaymentsController.prototype.handleStripeWebhook;

      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('webhook');
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
        RequestMethod.POST,
      );
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
    });
  });

  describe('createPaymentIntent', () => {
    describe('with CASH_ON_DELIVERY', () => {
      it('should mark the order as processing and confirm it for the owner', async () => {
        const user = buildUser();
        const order = buildOrder(user);
        ordersService.findOne.mockResolvedValue(order);

        const result = await controller.createPaymentIntent(
          PaymentMethod.CASH_ON_DELIVERY,
          order.id,
          user,
        );

        expect(ordersService.markAsProcessing).toHaveBeenCalledTimes(1);
        expect(ordersService.markAsProcessing).toHaveBeenCalledWith(
          order.id,
          PaymentMethod.CASH_ON_DELIVERY,
        );
        expect(result).toEqual({
          message: 'Order confirmed for cash on delivery',
        });
      });

      it('should not create a Stripe payment intent', async () => {
        const user = buildUser();
        const order = buildOrder(user);
        ordersService.findOne.mockResolvedValue(order);

        await controller.createPaymentIntent(
          PaymentMethod.CASH_ON_DELIVERY,
          order.id,
          user,
        );

        expect(paymentsService.createPaymentIntent).not.toHaveBeenCalled();
      });

      it('should throw UnauthorizedException and leave the order untouched when the user does not own it', async () => {
        const user = buildUser();
        const order = buildOrder(buildUser());
        ordersService.findOne.mockResolvedValue(order);

        await expect(
          controller.createPaymentIntent(
            PaymentMethod.CASH_ON_DELIVERY,
            order.id,
            user,
          ),
        ).rejects.toThrow(UnauthorizedException);

        expect(ordersService.markAsProcessing).not.toHaveBeenCalled();
      });

      it('should propagate errors thrown while marking the order as processing', async () => {
        const user = buildUser();
        const order = buildOrder(user);
        ordersService.findOne.mockResolvedValue(order);
        ordersService.markAsProcessing.mockRejectedValue(
          new Error('Order cannot be processed'),
        );

        await expect(
          controller.createPaymentIntent(
            PaymentMethod.CASH_ON_DELIVERY,
            order.id,
            user,
          ),
        ).rejects.toThrow('Order cannot be processed');
      });

      it('should propagate NotFoundException when the order does not exist', async () => {
        const user = buildUser();
        const orderId = faker.string.uuid();
        ordersService.findOne.mockRejectedValue(new NotFoundException());
        ordersService.markAsProcessing.mockRejectedValue(
          new NotFoundException(),
        );

        await expect(
          controller.createPaymentIntent(
            PaymentMethod.CASH_ON_DELIVERY,
            orderId,
            user,
          ),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('with CARD', () => {
      it('should load the order with its user, create a payment intent and return the client secret', async () => {
        const user = buildUser();
        const order = buildOrder(user);
        const paymentIntent = {
          id: 'pi_123',
          client_secret: 'pi_123_secret_abc',
        };
        ordersService.findOne.mockResolvedValue(order);
        paymentsService.createPaymentIntent.mockResolvedValue(paymentIntent);

        const result = await controller.createPaymentIntent(
          PaymentMethod.CARD,
          order.id,
          user,
        );

        expect(ordersService.findOne).toHaveBeenCalledWith(order.id, {
          relations: { user: true },
        });
        expect(paymentsService.createPaymentIntent).toHaveBeenCalledWith(
          order,
          PaymentMethod.CARD,
        );
        expect(result).toEqual({
          client_secret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        });
      });

      it('should not mark the order as processing (that happens after Stripe confirms the payment)', async () => {
        const user = buildUser();
        const order = buildOrder(user);
        ordersService.findOne.mockResolvedValue(order);
        paymentsService.createPaymentIntent.mockResolvedValue({
          id: 'pi_x',
          client_secret: 'secret',
        });

        await controller.createPaymentIntent(PaymentMethod.CARD, order.id, user);

        expect(ordersService.markAsProcessing).not.toHaveBeenCalled();
      });

      it('should throw UnauthorizedException and not create a payment intent when the user does not own the order', async () => {
        const user = buildUser();
        const order = buildOrder(buildUser());
        ordersService.findOne.mockResolvedValue(order);

        await expect(
          controller.createPaymentIntent(PaymentMethod.CARD, order.id, user),
        ).rejects.toThrow(UnauthorizedException);

        expect(paymentsService.createPaymentIntent).not.toHaveBeenCalled();
      });

      it('should propagate NotFoundException when the order does not exist', async () => {
        ordersService.findOne.mockRejectedValue(new NotFoundException());

        await expect(
          controller.createPaymentIntent(
            PaymentMethod.CARD,
            faker.string.uuid(),
            buildUser(),
          ),
        ).rejects.toThrow(NotFoundException);

        expect(paymentsService.createPaymentIntent).not.toHaveBeenCalled();
      });

      it('should propagate errors thrown by PaymentsService.createPaymentIntent', async () => {
        const user = buildUser();
        const order = buildOrder(user);
        ordersService.findOne.mockResolvedValue(order);
        paymentsService.createPaymentIntent.mockRejectedValue(
          new BadRequestException('Order is already paid'),
        );

        await expect(
          controller.createPaymentIntent(PaymentMethod.CARD, order.id, user),
        ).rejects.toThrow(BadRequestException);
      });
    });

    // NOTE: if you validate the body with a DTO + ValidationPipe instead of
    // inside the controller, move these cases to an e2e test.
    describe('with a missing or unsupported payment method', () => {
      it.each([
        ['undefined', undefined],
        ['null', null],
        ['an empty string', ''],
        ['an unknown value', 'BITCOIN'],
      ])(
        'should throw BadRequestException and call no downstream service when the method is %s',
        async (_label, method) => {
          const user = buildUser();
          const order = buildOrder(user);
          ordersService.findOne.mockResolvedValue(order);

          await expect(
            controller.createPaymentIntent(
              method as unknown as PaymentMethod,
              order.id,
              user,
            ),
          ).rejects.toThrow(BadRequestException);

          expect(paymentsService.createPaymentIntent).not.toHaveBeenCalled();
          expect(ordersService.markAsProcessing).not.toHaveBeenCalled();
        },
      );
    });
  });

  describe('handleStripeWebhook', () => {
    it('should pass the raw body and signature to PaymentsService.handleWebhook and return { received: true }', async () => {
      const rawBody = Buffer.from('payload');
      const signature = 'sig_test';

      const result = await controller.handleStripeWebhook(
        buildWebhookRequest(rawBody),
        signature,
      );

      expect(paymentsService.handleWebhook).toHaveBeenCalledTimes(1);
      expect(paymentsService.handleWebhook).toHaveBeenCalledWith(
        rawBody,
        signature,
      );
      expect(result).toEqual({ received: true });
    });

    it('should wait for webhook processing to finish before acknowledging', async () => {
      let finishProcessing: () => void = () => undefined;
      paymentsService.handleWebhook.mockReturnValue(
        new Promise<void>((resolve) => {
          finishProcessing = resolve;
        }),
      );

      let acknowledged = false;
      const pending = controller
        .handleStripeWebhook(buildWebhookRequest(Buffer.from('p')), 'sig')
        .then((response) => {
          acknowledged = true;
          return response;
        });

      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(acknowledged).toBe(false);

      finishProcessing();
      await expect(pending).resolves.toEqual({ received: true });
    });

    it('should propagate errors from PaymentsService.handleWebhook (e.g. invalid signature)', async () => {
      paymentsService.handleWebhook.mockRejectedValue(
        new BadRequestException('Invalid webhook signature'),
      );

      await expect(
        controller.handleStripeWebhook(
          buildWebhookRequest(Buffer.from('payload')),
          'sig',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['undefined', undefined],
      ['empty', ''],
    ])(
      'should throw BadRequestException without processing when the stripe-signature header is %s',
      async (_label, signature) => {
        await expect(
          controller.handleStripeWebhook(
            buildWebhookRequest(Buffer.from('payload')),
            signature as unknown as string,
          ),
        ).rejects.toThrow(BadRequestException);

        expect(paymentsService.handleWebhook).not.toHaveBeenCalled();
      },
    );

    it('should throw BadRequestException without processing when the raw body is unavailable', async () => {
      await expect(
        controller.handleStripeWebhook(buildWebhookRequest(undefined), 'sig'),
      ).rejects.toThrow(BadRequestException);

      expect(paymentsService.handleWebhook).not.toHaveBeenCalled();
    });
  });
});