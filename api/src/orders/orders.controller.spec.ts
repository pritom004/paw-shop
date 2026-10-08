import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { User } from '../users/entities/user.entity';
import { faker } from '@faker-js/faker';

describe('OrdersController', () => {
  let controller: OrdersController;
  let mockOrdersService: Partial<OrdersService>;

  const buildUser = (overrides: Partial<User> = {}): User =>
    ({
      id: faker.string.uuid(),
      admin: false,
      ...overrides,
    } as User);

  beforeEach(async () => {
    mockOrdersService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findAllUserOrders: jest.fn(),
      findOne: jest.fn(),
      findUserOrder: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      markAsProcessing: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call ordersService.create with dto and current user', async () => {
      const createOrderDto: CreateOrderDto = {
        petIds: [faker.string.uuid()],
        city: faker.location.city(),
        address: faker.location.streetAddress(),
        phoneNumber: faker.phone.number(),
      };
      const user = buildUser();
      const order = { id: faker.string.uuid() };
      (mockOrdersService.create as jest.Mock).mockResolvedValue(order);

      const result = await controller.create(createOrderDto, user);

      expect(mockOrdersService.create).toHaveBeenCalledWith(
        createOrderDto,
        user,
      );
      expect(result).toEqual(order);
    });
  });

  describe('findAll', () => {
    it('should return all orders (admin)', async () => {
      const orders = [
        { id: faker.string.uuid() },
        { id: faker.string.uuid() },
      ];
      (mockOrdersService.findAll as jest.Mock).mockResolvedValue(orders);

      const result = await controller.findAll();

      expect(mockOrdersService.findAll).toHaveBeenCalled();
      expect(result).toEqual(orders);
    });
  });

  describe('findAllUserOrders', () => {
    it('should call ordersService.findAllUserOrders with user id', async () => {
      const user = buildUser();
      const orders = [{ id: faker.string.uuid() }];
      (mockOrdersService.findAllUserOrders as jest.Mock).mockResolvedValue(
        orders,
      );

      const result = await controller.findAllUserOrders(user);

      expect(mockOrdersService.findAllUserOrders).toHaveBeenCalledWith(
        user.id,
      );
      expect(result).toEqual(orders);
    });
  });

  describe('findOne', () => {
    it('should call ordersService.findUserOrder with id and the full user object', async () => {
      const user = buildUser();
      const order = { id: faker.string.uuid() };
      (mockOrdersService.findUserOrder as jest.Mock).mockResolvedValue(order);

      const result = await controller.findOne(order.id, user);

      // The service signature takes a `User` object, not a user id.
      expect(mockOrdersService.findUserOrder).toHaveBeenCalledWith(
        order.id,
        user,
      );
      expect(result).toEqual(order);
    });
  });

  describe('update', () => {
    it('should call ordersService.update with id and dto', async () => {
      const id = faker.string.uuid();
      const updateOrderDto: UpdateOrderDto = {
        city: faker.location.city(),
      };
      const updatedOrder = { id, ...updateOrderDto };
      (mockOrdersService.update as jest.Mock).mockResolvedValue(updatedOrder);

      const result = await controller.update(id, updateOrderDto);

      expect(mockOrdersService.update).toHaveBeenCalledWith(id, updateOrderDto);
      expect(result).toEqual(updatedOrder);
    });
  });

  describe('remove', () => {
    it('should call ordersService.remove with id', async () => {
      const id = faker.string.uuid();
      (mockOrdersService.remove as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.remove(id);

      expect(mockOrdersService.remove).toHaveBeenCalledWith(id);
      expect(result).toBeUndefined();
    });
  });
});