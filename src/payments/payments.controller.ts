import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  type RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { type Request } from 'express';
import { PaymentMethod } from '../orders/entities/order.entity';
import { CurrentUser } from '../users/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly orderService: OrdersService,
    private readonly paymentService: PaymentsService,
  ) {}

  @Post('orders/:orderId/pay')
  async createPaymentIntent(
    @Body('paymentMethod') paymentMethod: PaymentMethod,
    @Param('orderId') orderId: string,
    @CurrentUser() user: User,
  ) {

      if(!PaymentsService.isValidPaymentMethod(paymentMethod)){
        throw new BadRequestException("Payment method is not valid!");
      }


    const order = await this.orderService.findOne(orderId, {
      relations: { user: true },
    });

    if (order.user.id !== user.id) {
      throw new UnauthorizedException('Unauthorized request');
    }

    if (paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
      await this.orderService.markAsProcessing(orderId, paymentMethod);
      return { message: 'Order confirmed for cash on delivery' };
    }
    
    const paymentIntent = await this.paymentService.createPaymentIntent(
      order,
      paymentMethod,
    );

    return {
      client_secret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }

  @Post('webhook')
  @HttpCode(200)
  
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
  
        if(!req.rawBody){
          throw new BadRequestException("rawBody is undefined")
        }

      if(!signature){
        throw new BadRequestException("signature is undefined")
      }

    await this.paymentService.handleWebhook(req.rawBody, signature);
    return {
      received: true,
    };
  }
}
