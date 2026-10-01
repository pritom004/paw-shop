import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { OrdersModule } from '../orders/orders.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';

@Module({
  providers: [PaymentsService],
  controllers: [PaymentsController],
  imports: [OrdersModule, TypeOrmModule.forFeature([Order])]
})
export class PaymentsModule {}
