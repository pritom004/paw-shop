import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe, { type PaymentIntent } from 'stripe';
import { ConfigService } from '@nestjs/config';
import { Order, PaymentMethod } from '../orders/entities/order.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class PaymentsService {
  private readonly strip!: Stripe;
  private readonly webhookSecret!: string;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
  ) {
    this.strip = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY')!,
      {
        apiVersion: '2026-08-26.dahlia',
      }
    );
  }
  async createPaymentIntent(order: Order, paymentMethod: PaymentMethod): Promise<PaymentIntent>{

    if(paymentMethod === PaymentMethod.CASH_ON_DELIVERY){
        throw new BadRequestException('Cash on delivery does not require a payment intent');
    }

    const paymentIntent = await this.strip.paymentIntents.create({
        amount: Math.round(order.totalAmount * 100),
        currency: 'usd',
        metadata: {
            orderId: order.id,
            userId: order.user.id
        },
        automatic_payment_methods: {
            enabled: true
        }
    })



    order.stripePaymentIntentId= paymentIntent.id;
    order.paymentMethod = paymentMethod;
    await this.orderRepository.save(order);


    return paymentIntent;

  }
}
