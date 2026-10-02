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
  private readonly strip!: Stripe;
  private readonly webhookSecret!: string;
  private readonly logger!: Logger;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    )!;
    this.logger = new Logger(PaymentsService.name);
    this.strip = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY')!,
      {
        apiVersion: '2026-08-26.dahlia',
      },
    );
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

    const paymentIntent = await this.strip.paymentIntents.create({
      amount: Math.round(order.totalAmount * 100),
      currency: 'usd',
      metadata: {
        orderId: order.id,
        userId: order.user.id,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    order.stripePaymentIntentId = paymentIntent.id;
    order.paymentMethod = paymentMethod;
    await this.orderRepository.save(order);

    return paymentIntent;
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;

    try {
      event = this.strip.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Webhook signature verification failed: ${error.message}`,
        );
        throw new BadRequestException('Invalid webhook signature');
      } else {
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        this.handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        this.handlePaymentIntentFailed(event.data.object);
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
    if (!orderId) return;

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) return;

    order.paymentStatus = PaymentStatus.FAILED;
    await this.orderRepository.save(order);

    this.logger.log(`Order ${orderId} payment failed`);
  }
}
