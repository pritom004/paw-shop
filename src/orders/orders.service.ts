import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { PetsService } from '../pets/pets.service';
import { OrderItem } from './entities/order-item.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly petsService: PetsService
  ) {}

  async create(createOrderDto: CreateOrderDto, user: User) {
    const { petIds, city, address, phoneNumber } = createOrderDto;

    const order = this.orderRepository.create({
      city,
      address,
      phoneNumber,
    });

    const orderItems: OrderItem[] = [];
    let totalAmount = 0;

    for (let petId of petIds) {
      const pet = await this.petsService.findOne(petId);

      if (!pet.isAvailable) {
        throw new BadRequestException(
          `The pet ${pet.name} is no longer available for adoption`,
        );
      }
      await this.petsService.update(pet.id, { isAvailable: false });

      const orderItem = this.orderItemRepository.create({
        price: pet.price,
        pet,
      });

      totalAmount += pet.price;
      orderItems.push(orderItem);
    }

    order.user = user;
    order.orderItems = orderItems;
    order.totalAmount = totalAmount;

    return this.orderRepository.save(order);
  }

  findAll() {
    return `This action returns all orders`;
  }

  findOne(id: number) {
    return `This action returns a #${id} order`;
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
