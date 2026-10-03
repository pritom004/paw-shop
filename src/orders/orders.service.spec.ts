import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { PetsService } from '../pets/pets.service';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { UpdateOrderDto } from './dto/update-order.dto';

describe('OrdersService', () => {
  let service: OrdersService;
  let mockOrderRepository: Partial<Repository<Order>>;
  let mockOrderItemRepository: Partial<Repository<OrderItem>>;
  let mockPetsService: Partial<PetsService>;

  beforeEach(async () => {
    mockOrderRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    mockOrderItemRepository = {
      create: jest.fn(),
    };
    mockPetsService = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: mockOrderRepository },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: mockOrderItemRepository,
        },
        { provide: PetsService, useValue: mockPetsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an order with order items and total amount', async () => {
      const createOrderDto = {
        petIds: ['pet1', 'pet2'],
        city: 'City',
        address: 'Address',
        phoneNumber: '1234567890',
      };
      const user = { id: 'user1' } as User;

      const pet1 = { id: 'pet1', name: 'Pet1', price: 100, isAvailable: true };
      const pet2 = { id: 'pet2', name: 'Pet2', price: 200, isAvailable: true };

      (mockPetsService.findOne as jest.Mock).mockImplementation((id) => {
        if (id === 'pet1') return Promise.resolve(pet1);
        if (id === 'pet2') return Promise.resolve(pet2);
      });
      (mockPetsService.update as jest.Mock).mockResolvedValue(undefined);

      const orderItem1 = { price: 100, pet: pet1 };
      const orderItem2 = { price: 200, pet: pet2 };
      (mockOrderItemRepository.create as jest.Mock).mockImplementation(
        (dto) => dto,
      );

      const order = {
        id: 'order1',
        city: 'City',
        address: 'Address',
        phoneNumber: '1234567890',
      };
      (mockOrderRepository.create as jest.Mock).mockReturnValue(order);
      (mockOrderRepository.save as jest.Mock).mockImplementation((o) =>
        Promise.resolve(o),
      );

      const result = await service.create(createOrderDto, user);

      expect(mockPetsService.findOne).toHaveBeenCalledTimes(2);
      expect(mockPetsService.findOne).toHaveBeenNthCalledWith(1, 'pet1');
      expect(mockPetsService.findOne).toHaveBeenNthCalledWith(2, 'pet2');
      expect(mockPetsService.update).toHaveBeenCalledTimes(2);
      expect(mockPetsService.update).toHaveBeenNthCalledWith(1, 'pet1', {
        isAvailable: false,
      });
      expect(mockPetsService.update).toHaveBeenNthCalledWith(2, 'pet2', {
        isAvailable: false,
      });

      expect(mockOrderItemRepository.create).toHaveBeenCalledTimes(2);
      expect(mockOrderItemRepository.create).toHaveBeenNthCalledWith(1, {
        price: 100,
        pet: pet1,
      });
      expect(mockOrderItemRepository.create).toHaveBeenNthCalledWith(2, {
        price: 200,
        pet: pet2,
      });

      expect(mockOrderRepository.create).toHaveBeenCalledWith({
        city: 'City',
        address: 'Address',
        phoneNumber: '1234567890',
      });
      expect(mockOrderRepository.save).toHaveBeenCalledWith({
        ...order,
        user,
        orderItems: [orderItem1, orderItem2],
        totalAmount: 300,
      });
      expect(result).toEqual({
        ...order,
        user,
        orderItems: [orderItem1, orderItem2],
        totalAmount: 300,
      });
    });

    it('should throw BadRequestException if a pet is not available', async () => {
      const createOrderDto = {
        petIds: ['pet1'],
        city: 'City',
        address: 'Address',
        phoneNumber: '1234567890',
      };
      const user = { id: 'user1' } as User;
      const pet1 = { id: 'pet1', name: 'Pet1', price: 100, isAvailable: false };

      (mockPetsService.findOne as jest.Mock).mockResolvedValue(pet1);

      await expect(service.create(createOrderDto, user)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all orders', async () => {
      const orders = [{ id: '1' }, { id: '2' }];
      (mockOrderRepository.find as jest.Mock).mockResolvedValue(orders);

      const result = await service.findAll();
      expect(result).toEqual(orders);
      expect(mockOrderRepository.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an order if found', async () => {
      const order = { id: '1' };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);

      const result = await service.findOne('1');
      expect(result).toEqual(order);
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException if order not found', async () => {
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });

    it('should pass options to findOne', async () => {
      const order = { id: '1' };
      const options = { relations: { orderItems: true } };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);

      await service.findOne('1', { relations: { orderItems: true } });
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        ...options,
        where: { id: '1' },
      });
    });
  });

  describe('update', () => {
    it('should update and save an order if found', async () => {
      const order = {
        id: '1',
        city: 'Old City',
        address: 'Old Address',
        phoneNumber: '1111111111',
      };
      const updateOrderDto: UpdateOrderDto = {
        city: 'New City',
        address: 'New Address',
      };
      const updatedOrder = { ...order, ...updateOrderDto };

      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);
      (mockOrderRepository.save as jest.Mock).mockResolvedValue(updatedOrder);

      const result = await service.update('1', updateOrderDto);

      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(mockOrderRepository.save).toHaveBeenCalledWith(updatedOrder);
      expect(result).toEqual(updatedOrder);
    });

    it('should throw NotFoundException if order not found', async () => {
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.update('1', { city: 'New City' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should only update provided fields and preserve the rest', async () => {
      const order = {
        id: '1',
        city: 'Old City',
        address: 'Old Address',
        phoneNumber: '1111111111',
      };
      const updateOrderDto: UpdateOrderDto = { city: 'New City' };

      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);
      (mockOrderRepository.save as jest.Mock).mockImplementation((o) =>
        Promise.resolve(o),
      );

      const result = await service.update('1', updateOrderDto);

      expect(result.city).toBe('New City');
      expect(result.address).toBe('Old Address');
      expect(result.phoneNumber).toBe('1111111111');
    });
  });

  describe('remove', () => {
    it('should remove an order if found', async () => {
      const order = { id: '1' };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);
      (mockOrderRepository.delete as jest.Mock).mockResolvedValue(undefined);

      await service.remove('1');
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(mockOrderRepository.delete).toHaveBeenCalledWith(order);
    });

    it('should throw NotFoundException if order not found', async () => {
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsProcessing', () => {
    it('should update order status and payment method', async () => {
      const order = {
        id: '1',
        orderStatus: OrderStatus.PENDING,
        paymentMethod: null,
      };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);
      (mockOrderRepository.save as jest.Mock).mockImplementation((o) =>
        Promise.resolve(o),
      );

      const result = await service.markAsProcessing('1', PaymentMethod.CARD);

      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(order.orderStatus).toBe(OrderStatus.PROCESSING);
      expect(order.paymentMethod).toBe(PaymentMethod.CARD);
      expect(mockOrderRepository.save).toHaveBeenCalledWith(order);
      expect(result).toEqual(order);
    });

    it('should throw NotFoundException if order not found', async () => {
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.markAsProcessing('1', PaymentMethod.CARD),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
