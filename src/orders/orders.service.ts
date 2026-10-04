import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { FindOneOptions, Repository } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
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
    private readonly petsService: PetsService,
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
    return this.orderRepository.find();
  }

  findAllUserOrders(userId: string){


return this.orderRepository.find({
  where: {
    user: {
      id: userId
    }
  }
})

  }

  async findOne(id: string, options?: FindOneOptions<Order>) {
    const order = await this.orderRepository.findOne({
      ...(options as object),
      where: {
        id,
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found!');
    }

    return order;
  }


    async findUserOrder(id: string, user: User) {
    const order = await this.orderRepository.findOne({
      where: {
        id,
      },
      relations: {
        user: true,
        orderItems: true
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found!');
    }

    if(order.user.id !== user.id && user.admin !== true){
      throw new UnauthorizedException("You are not authorized to view this order.");
    }

    return order;
  }



  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.orderRepository.findOne({
      where: { id },
    });
    if (!order) {
      throw new NotFoundException('Order not found!');
    }

    Object.assign(order, updateOrderDto);

    return this.orderRepository.save(order);
  }

  async remove(id: string) {
    const order = await this.orderRepository.findOne({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('Order not found!');
    }

    await this.orderRepository.delete(order);
  }

  async markAsProcessing(orderId: string, paymentMethod: PaymentMethod) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found!');
    }

    order.orderStatus = OrderStatus.PROCESSING;
    order.paymentMethod = paymentMethod;

    return this.orderRepository.save(order);
  }
}
