import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PetsModule } from '../pets/pets.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  imports: [PetsModule, TypeOrmModule.forFeature([Order, OrderItem])],
  exports: [OrdersService]
})
export class OrdersModule {}
