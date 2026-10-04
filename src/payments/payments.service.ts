import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import {
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../orders/entities/order.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class PaymentsService {
  private readonly stripe!: Stripe;
  private readonly webhookSecret!: string;
  private readonly logger!: Logger;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
  ) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (webhookSecret) {
      this.webhookSecret = webhookSecret!;
    } else {
      throw Error('Webhook STRIPE_WEBHOOK_SECRET is not empty');
    }

    this.logger = new Logger(PaymentsService.name);
    const scriptSecret = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (scriptSecret) {
      this.stripe = new Stripe(scriptSecret, {
        apiVersion: '2026-08-26.dahlia',
      });
    } else {
      throw new Error('Scrip STRIPE_SECRET_KEY is empty');
    }
  }

  async createPaymentIntent(
    order: Order,
    paymentMethod: PaymentMethod,
  ): Promise<Stripe.PaymentIntent> {
    if (paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
      throw new BadRequestException(
        'Cash on delivery does not require a payment intent',
      );
    }

    const total = Number(order.totalAmount);

    if (!Number.isFinite(total) || total <= 0) {
      throw new BadRequestException(
        'The order total provided is not a valid number.',
      );
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Payment is already paid');
    }

    const orderAmount = Math.round(Number((total * 100).toFixed(10)));

    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      throw new BadRequestException(
        'Payment amount must be a finite, positive number.',
      );
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: orderAmount,
      currency: 'usd',
      metadata: {
        orderId: order.id,
        userId: order.user.id,
      },
      automatic_payment_methods: { enabled: true },
    });

    order.stripePaymentIntentId = paymentIntent.id;
    order.paymentMethod = paymentMethod;
    await this.orderRepository.save(order);

    return paymentIntent;
  }
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      if (err instanceof Error) {
        this.logger.error(
          `Webhook signature verification failed: ${err.message}`,
        );
      }
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      this.logger.warn('PaymentIntent succeeded but no orderId in metadata');
      return;
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      this.logger.warn(
        `Order ${orderId} not found for payment intent ${paymentIntent.id}`,
      );
      return;
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      return;
    }

    order.paymentStatus = PaymentStatus.PAID;
    order.orderStatus = OrderStatus.PROCESSING;
    await this.orderRepository.save(order);

    this.logger.log(`Order ${orderId} marked as PAID and PROCESSING`);
  }
  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      this.logger.warn(
        `PaymentIntent ${paymentIntent.id} failed but no orderId in metadata`,
      );
      return;
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      this.logger.warn(
        `Order ${orderId} not found for payment intent ${paymentIntent.id}`,
      );
      return;
    }

    if (
      order.paymentStatus === PaymentStatus.PAID ||
      order.paymentStatus === PaymentStatus.REFUNDED
    ) {
      this.logger.warn(
        `Ignoring payment_failed for order ${orderId}: current status is ${order.paymentStatus}`,
      );
      return;
    }

    if (
      order.stripePaymentIntentId &&
      order.stripePaymentIntentId !== paymentIntent.id
    ) {
      this.logger.warn(
        `Ignoring payment_failed for order ${orderId}: intent ${paymentIntent.id} is not the active one (${order.stripePaymentIntentId})`,
      );
      return;
    }

    order.paymentStatus = PaymentStatus.FAILED;
    await this.orderRepository.save(order);

    this.logger.log(`Order ${orderId} payment failed`);
  }

  static isValidPaymentMethod(method: any): method is PaymentMethod {
    return Object.values(PaymentMethod).includes(method);
  }
}
