import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { faker } from '@faker-js/faker';
import Stripe from 'stripe';
import {
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../orders/entities/order.entity';
import { PaymentsService } from './payments.service';

jest.mock('stripe');

describe('PaymentsService', () => {
  const SECRET_KEY = 'sk_test_123';
  const WEBHOOK_SECRET = 'whsec_test_123';

  let service: PaymentsService;
  let orderRepository: { save: jest.Mock; findOne: jest.Mock };
  let stripeMock: {
    paymentIntents: { create: jest.Mock };
    webhooks: { constructEvent: jest.Mock };
  };
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  // ---------------------------------------------------------------- helpers

  const buildOrder = (overrides: Partial<Order> = {}): Order =>
    ({
      id: faker.string.uuid(),
      totalAmount: faker.number.int({ min: 1000, max: 100000 }) / 100,
      paymentStatus: PaymentStatus.PENDING,
      orderStatus: OrderStatus.PENDING,
      user: { id: faker.string.uuid() },
      ...overrides,
    }) as unknown as Order;

  const buildEvent = (
    type: string,
    metadata: Record<string, string> = {},
  ): Stripe.Event =>
    ({
      id: `evt_${faker.string.alphanumeric(14)}`,
      type,
      data: {
        object: { id: `pi_${faker.string.alphanumeric(14)}`, metadata },
      },
    }) as unknown as Stripe.Event;

  const flushPromises = () =>
    new Promise<void>((resolve) => setImmediate(resolve));

  /** Always returns a promise, so one failing contract doesn't mask the others. */
  const handleWebhook = async (rawBody = Buffer.from('payload'), sig = 'sig') =>
    service.handleWebhook(rawBody, sig);

  /**
   * Asserts that webhook processing rejects with `message`.
   * If the handlers are not awaited, the failure surfaces as an unhandled
   * rejection; waiting one macrotask lets Jest attribute it to *this* test
   * instead of crashing the whole run once the test has already finished.
   */
  const expectWebhookToReject = async (message: string) => {
    const outcome = handleWebhook();
    outcome.catch(() => undefined);
    await flushPromises();
    await expect(outcome).rejects.toThrow(message);
  };

  const createService = async (
    configOverrides: Record<string, string | undefined> = {},
  ): Promise<PaymentsService> => {
    const values: Record<string, string | undefined> = {
      STRIPE_SECRET_KEY: SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      ...configOverrides,
    };
    // Supports both `get` and `getOrThrow` so tests don't care which one the service uses.
    const configService = {
      get: jest.fn((key: string) => values[key]),
      getOrThrow: jest.fn((key: string) => {
        const value = values[key];
        if (value === undefined) {
          throw new Error(`Configuration key "${key}" does not exist`);
        }
        return value;
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    return module.get(PaymentsService);
  };

  // ------------------------------------------------------------------ setup

  beforeEach(async () => {
    stripeMock = {
      paymentIntents: { create: jest.fn() },
      webhooks: { constructEvent: jest.fn() },
    };
    (Stripe as unknown as jest.Mock).mockReset();
    (Stripe as unknown as jest.Mock).mockImplementation(() => stripeMock);

    orderRepository = {
      save: jest.fn(async (order: Order) => order),
      findOne: jest.fn(),
    };

    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    service = await createService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ------------------------------------------------------------ constructor

  describe('constructor', () => {
    it('should create the Stripe client with the configured secret key and a pinned API version', () => {
      expect(Stripe).toHaveBeenCalledTimes(1);
      expect(Stripe).toHaveBeenCalledWith(
        SECRET_KEY,
        expect.objectContaining({ apiVersion: expect.any(String) }),
      );
    });

    it.each(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'])(
      'should fail fast when %s is not configured',
      async (key) => {
        await expect(createService({ [key]: undefined })).rejects.toThrow();
      },
    );
  });

  // --------------------------------------------------- createPaymentIntent

  describe('createPaymentIntent', () => {
    const paymentIntent = {
      id: 'pi_test_123',
      client_secret: 'pi_test_123_secret',
    };

    beforeEach(() => {
      stripeMock.paymentIntents.create.mockResolvedValue(paymentIntent);
    });

    it('should create a USD payment intent for the order total with order and user metadata', async () => {
      const order = buildOrder({ totalAmount: 49.99 });

      await service.createPaymentIntent(order, PaymentMethod.CARD);

      expect(stripeMock.paymentIntents.create).toHaveBeenCalledTimes(1);
      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 4999,
          currency: 'usd',
          metadata: { orderId: order.id, userId: order.user.id },
          automatic_payment_methods: { enabled: true },
        }),
      );
    });

    it('should return the payment intent created by Stripe', async () => {
      const result = await service.createPaymentIntent(
        buildOrder(),
        PaymentMethod.CARD,
      );

      expect(result).toEqual(paymentIntent);
    });

    it('should store the payment intent id and payment method on the order and save it', async () => {
      const order = buildOrder();

      await service.createPaymentIntent(order, PaymentMethod.CARD);

      expect(order.stripePaymentIntentId).toBe(paymentIntent.id);
      expect(order.paymentMethod).toBe(PaymentMethod.CARD);
      expect(orderRepository.save).toHaveBeenCalledTimes(1);
      expect(orderRepository.save).toHaveBeenCalledWith(order);
    });

    describe('amount conversion', () => {
      it('should convert random two-decimal totals to the exact number of cents', async () => {
        for (let i = 0; i < 25; i++) {
          const cents = faker.number.int({ min: 50, max: 10_000_000 });
          const order = buildOrder({ totalAmount: cents / 100 });
          stripeMock.paymentIntents.create.mockClear();

          await service.createPaymentIntent(order, PaymentMethod.CARD);

          expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
            expect.objectContaining({ amount: cents }),
          );
        }
      });

      it.each([
        [49.99, 4999],
        [19.99, 1999],
        [0.5, 50],
        [1234.56, 123456],
        [0.1 + 0.2, 30], // 0.30000000000000004
        [10.005, 1001],
        [1.005, 101], // floating point: 1.005 * 100 === 100.49999999999999
        [1.255, 126], // floating point: 1.255 * 100 === 125.49999999999999
        [8.325, 833], // floating point: 8.325 * 100 === 832.4999999999999
      ])(
        'should convert %p dollars to %p cents (rounding half up)',
        async (dollars, cents) => {
          const order = buildOrder({ totalAmount: dollars });

          await service.createPaymentIntent(order, PaymentMethod.CARD);

          const { amount } = stripeMock.paymentIntents.create.mock.calls[0][0];
          expect(Number.isInteger(amount)).toBe(true);
          expect(amount).toBe(cents);
        },
      );

      it('should handle totals that arrive as numeric strings (e.g. TypeORM decimal columns)', async () => {
        const order = buildOrder({
          totalAmount: '49.99' as unknown as number,
        });

        await service.createPaymentIntent(order, PaymentMethod.CARD);

        expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
          expect.objectContaining({ amount: 4999 }),
        );
      });
    });

    describe('validation', () => {
      it('should throw BadRequestException for CASH_ON_DELIVERY without calling Stripe or saving', async () => {
        await expect(
          service.createPaymentIntent(
            buildOrder(),
            PaymentMethod.CASH_ON_DELIVERY,
          ),
        ).rejects.toThrow(BadRequestException);

        expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
        expect(orderRepository.save).not.toHaveBeenCalled();
      });

      it.each([
        ['zero', 0],
        ['negative', -10],
        ['NaN', NaN],
        ['Infinity', Infinity],
      ])(
        'should throw BadRequestException when the order total is %s',
        async (_label, totalAmount) => {
          const order = buildOrder({ totalAmount });

          await expect(
            service.createPaymentIntent(order, PaymentMethod.CARD),
          ).rejects.toThrow(BadRequestException);

          expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
          expect(orderRepository.save).not.toHaveBeenCalled();
        },
      );

      it('should throw BadRequestException when the order is already paid', async () => {
        const order = buildOrder({ paymentStatus: PaymentStatus.PAID });

        await expect(
          service.createPaymentIntent(order, PaymentMethod.CARD),
        ).rejects.toThrow(BadRequestException);

        expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
        expect(orderRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('failures', () => {
      it('should propagate Stripe errors and leave the order unchanged', async () => {
        const order = buildOrder();
        stripeMock.paymentIntents.create.mockRejectedValue(
          new Error('Stripe failure'),
        );

        await expect(
          service.createPaymentIntent(order, PaymentMethod.CARD),
        ).rejects.toThrow('Stripe failure');

        expect(order.stripePaymentIntentId).toBeUndefined();
        expect(order.paymentMethod).toBeUndefined();
        expect(orderRepository.save).not.toHaveBeenCalled();
      });

      it('should propagate repository errors when saving the order fails', async () => {
        orderRepository.save.mockRejectedValue(new Error('DB down'));

        await expect(
          service.createPaymentIntent(buildOrder(), PaymentMethod.CARD),
        ).rejects.toThrow('DB down');
      });
    });
  });

  // ----------------------------------------------------------- handleWebhook

  describe('handleWebhook', () => {
    it('should return a promise so callers can await webhook processing', async () => {
      stripeMock.webhooks.constructEvent.mockReturnValue(
        buildEvent('customer.created'),
      );

      const result = service.handleWebhook(Buffer.from('payload'), 'sig');

      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    describe('signature verification', () => {
      it('should verify the payload with the signature and the configured webhook secret', async () => {
        const rawBody = Buffer.from('payload');
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent('customer.created'),
        );

        await handleWebhook(rawBody, 'sig_test');

        expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(
          rawBody,
          'sig_test',
          WEBHOOK_SECRET,
        );
      });

      it('should throw BadRequestException and log an error when verification fails', async () => {
        stripeMock.webhooks.constructEvent.mockImplementation(() => {
          throw new Error('No signatures found');
        });

        await expect(handleWebhook(Buffer.from('x'), 'bad')).rejects.toThrow(
          BadRequestException,
        );

        expect(errorSpy).toHaveBeenCalled();
      });

      it('should throw BadRequestException when a non-Error value is thrown during verification', async () => {
        stripeMock.webhooks.constructEvent.mockImplementation(() => {
          throw 'unexpected string';
        });

        await expect(handleWebhook(Buffer.from('x'), 'bad')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should not expose the underlying verification error to the caller', async () => {
        stripeMock.webhooks.constructEvent.mockImplementation(() => {
          throw new Error('secret internal detail');
        });

        await expect(handleWebhook(Buffer.from('x'), 'bad')).rejects.toThrow(
          expect.objectContaining({
            message: expect.not.stringContaining('secret internal detail'),
          }),
        );
      });

      it('should not touch the database when verification fails', async () => {
        stripeMock.webhooks.constructEvent.mockImplementation(() => {
          throw new Error('No signatures found');
        });

        await expect(handleWebhook()).rejects.toThrow();

        expect(orderRepository.findOne).not.toHaveBeenCalled();
        expect(orderRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('payment_intent.succeeded', () => {
      it('should mark the order as PAID and PROCESSING and save it', async () => {
        const order = buildOrder();
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent('payment_intent.succeeded', { orderId: order.id }),
        );
        orderRepository.findOne.mockResolvedValue(order);

        await handleWebhook();

        expect(orderRepository.findOne).toHaveBeenCalledWith({
          where: { id: order.id },
        });
        expect(order.paymentStatus).toBe(PaymentStatus.PAID);
        expect(order.orderStatus).toBe(OrderStatus.PROCESSING);
        expect(orderRepository.save).toHaveBeenCalledTimes(1);
        expect(orderRepository.save).toHaveBeenCalledWith(order);
      });

      it('should be idempotent: an already PAID order is not saved again', async () => {
        const order = buildOrder({ paymentStatus: PaymentStatus.PAID });
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent('payment_intent.succeeded', { orderId: order.id }),
        );
        orderRepository.findOne.mockResolvedValue(order);

        await handleWebhook();

        expect(orderRepository.save).not.toHaveBeenCalled();
      });

      it('should do nothing and warn when the payment intent has no orderId metadata', async () => {
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent('payment_intent.succeeded', {}),
        );

        await handleWebhook();

        expect(orderRepository.findOne).not.toHaveBeenCalled();
        expect(orderRepository.save).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
      });

      it('should do nothing and warn when the order cannot be found', async () => {
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent('payment_intent.succeeded', { orderId: 'missing' }),
        );
        orderRepository.findOne.mockResolvedValue(null);

        await handleWebhook();

        expect(orderRepository.save).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
      });

      it('should not log the event as unhandled', async () => {
        const order = buildOrder();
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent('payment_intent.succeeded', { orderId: order.id }),
        );
        orderRepository.findOne.mockResolvedValue(order);

        await handleWebhook();

        expect(logSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('Unhandled event type'),
        );
      });
    });

    describe('payment_intent.payment_failed', () => {
      it('should mark the order payment as FAILED and save it', async () => {
        const order = buildOrder();
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent('payment_intent.payment_failed', { orderId: order.id }),
        );
        orderRepository.findOne.mockResolvedValue(order);

        await handleWebhook();

        expect(orderRepository.findOne).toHaveBeenCalledWith({
          where: { id: order.id },
        });
        expect(order.paymentStatus).toBe(PaymentStatus.FAILED);
        expect(orderRepository.save).toHaveBeenCalledTimes(1);
        expect(orderRepository.save).toHaveBeenCalledWith(order);
      });

      it('should not move the order out of PENDING (the customer must be able to retry)', async () => {
        const order = buildOrder({ orderStatus: OrderStatus.PENDING });
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent('payment_intent.payment_failed', { orderId: order.id }),
        );
        orderRepository.findOne.mockResolvedValue(order);

        await handleWebhook();

        expect(order.orderStatus).toBe(OrderStatus.PENDING);
      });

      it('should never downgrade an already PAID order (out-of-order or retried events)', async () => {
        const order = buildOrder({
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.PROCESSING,
        });
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent('payment_intent.payment_failed', { orderId: order.id }),
        );
        orderRepository.findOne.mockResolvedValue(order);

        await handleWebhook();

        expect(order.paymentStatus).toBe(PaymentStatus.PAID);
        expect(orderRepository.save).not.toHaveBeenCalled();
      });

      it('should do nothing when the payment intent has no orderId metadata', async () => {
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent('payment_intent.payment_failed', {}),
        );

        await handleWebhook();

        expect(orderRepository.findOne).not.toHaveBeenCalled();
        expect(orderRepository.save).not.toHaveBeenCalled();
      });

      it('should do nothing when the order cannot be found', async () => {
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent('payment_intent.payment_failed', { orderId: 'missing' }),
        );
        orderRepository.findOne.mockResolvedValue(null);

        await handleWebhook();

        expect(orderRepository.save).not.toHaveBeenCalled();
      });

      it('should not log the event as unhandled', async () => {
        const order = buildOrder();
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent('payment_intent.payment_failed', { orderId: order.id }),
        );
        orderRepository.findOne.mockResolvedValue(order);

        await handleWebhook();

        expect(logSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('Unhandled event type'),
        );
      });
    });

    describe('unhandled event types', () => {
      it('should ignore them without touching the database', async () => {
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent('customer.created'),
        );

        await expect(handleWebhook()).resolves.toBeUndefined();

        expect(orderRepository.findOne).not.toHaveBeenCalled();
        expect(orderRepository.save).not.toHaveBeenCalled();
      });
    });

    describe.each([
      ['payment_intent.succeeded'],
      ['payment_intent.payment_failed'],
    ])('%s processing guarantees', (eventType) => {
      it('should only resolve after the order has been persisted', async () => {
        const order = buildOrder();
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent(eventType, { orderId: order.id }),
        );
        orderRepository.findOne.mockResolvedValue(order);

        let releaseSave: () => void = () => undefined;
        orderRepository.save.mockImplementation(
          () =>
            new Promise((resolve) => {
              releaseSave = () => resolve(order);
            }),
        );

        let settled = false;
        const pending = Promise.resolve(
          service.handleWebhook(Buffer.from('payload'), 'sig'),
        ).then(() => {
          settled = true;
        });

        await flushPromises();
        expect(orderRepository.save).toHaveBeenCalledTimes(1);
        expect(settled).toBe(false);

        releaseSave();
        await pending;
        expect(settled).toBe(true);
      });

      it('should reject when loading the order fails so Stripe retries the webhook', async () => {
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent(eventType, { orderId: faker.string.uuid() }),
        );
        orderRepository.findOne.mockRejectedValue(new Error('DB read failed'));

        await expectWebhookToReject('DB read failed');
      });

      it('should reject when saving the order fails so Stripe retries the webhook', async () => {
        const order = buildOrder();
        stripeMock.webhooks.constructEvent.mockReturnValue(
          buildEvent(eventType, { orderId: order.id }),
        );
        orderRepository.findOne.mockResolvedValue(order);
        orderRepository.save.mockRejectedValue(new Error('DB write failed'));

        await expectWebhookToReject('DB write failed');
      });
    });
  });
});