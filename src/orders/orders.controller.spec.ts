import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { User } from '../users/entities/user.entity';

describe('OrdersController', () => {
  let controller: OrdersController;
  let mockOrdersService: Partial<OrdersService>;

  beforeEach(async () => {
    mockOrdersService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findAllUserOrders: jest.fn(),
      findOne: jest.fn(),
      findUserOrder: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
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
    it('should call ordersService.create with dto and user', async () => {
      const createOrderDto: CreateOrderDto = {
        petIds: ['pet1'],
        city: 'City',
        address: 'Address',
        phoneNumber: '1234567890',
      };
      const user = { id: 'user1' } as User;
      const order = { id: 'order1' };
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
      const orders = [{ id: '1' }, { id: '2' }];
      (mockOrdersService.findAll as jest.Mock).mockResolvedValue(orders);

      const result = await controller.findAll();

      expect(mockOrdersService.findAll).toHaveBeenCalled();
      expect(result).toEqual(orders);
    });
  });

  describe('findAllUserOrders', () => {
    it('should call ordersService.findAllUserOrders with user id', async () => {
      const user = { id: 'user1' } as User;
      const orders = [{ id: '1' }, { id: '2' }];
      (mockOrdersService.findAllUserOrders as jest.Mock).mockResolvedValue(
        orders,
      );

      const result = await controller.findAllUserOrders(user);

      expect(mockOrdersService.findAllUserOrders).toHaveBeenCalledWith('user1');
      expect(result).toEqual(orders);
    });
  });

  describe('findOne', () => {
    it('should call ordersService.findUserOrder with id and user id', async () => {
      const user = { id: 'user1' } as User;
      const order = { id: '1' };
      (mockOrdersService.findUserOrder as jest.Mock).mockResolvedValue(order);

      const result = await controller.findOne('1', user);

      expect(mockOrdersService.findUserOrder).toHaveBeenCalledWith('1', 'user1');
      expect(result).toEqual(order);
    });
  });

  describe('update', () => {
    it('should call ordersService.update with id and dto', async () => {
      const updateOrderDto: UpdateOrderDto = { city: 'New City' };
      const updatedOrder = { id: '1', city: 'New City' };
      (mockOrdersService.update as jest.Mock).mockResolvedValue(updatedOrder);

      const result = await controller.update('1', updateOrderDto);

      expect(mockOrdersService.update).toHaveBeenCalledWith(
        '1',
        updateOrderDto,
      );
      expect(result).toEqual(updatedOrder);
    });
  });

  describe('remove', () => {
    it('should call ordersService.remove with id', async () => {
      (mockOrdersService.remove as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.remove('1');

      expect(mockOrdersService.remove).toHaveBeenCalledWith('1');
      expect(result).toBeUndefined();
    });
  });
});