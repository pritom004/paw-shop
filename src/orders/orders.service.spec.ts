import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { PetsService } from '../pets/pets.service';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { faker } from '@faker-js/faker';

describe('OrdersService', () => {
  let service: OrdersService;
  let mockOrderRepository: Partial<Repository<Order>>;
  let mockOrderItemRepository: Partial<Repository<OrderItem>>;
  let mockPetsService: Partial<PetsService>;

  const buildPet = (overrides: Partial<any> = {}) => ({
    id: faker.string.uuid(),
    name: faker.animal.cat(),
    price: faker.number.float({ min: 10, max: 500 }),
    isAvailable: true,
    ...overrides,
  });

  const buildUser = (overrides: Partial<User> = {}): User =>
    ({
      id: faker.string.uuid(),
      admin: false,
      ...overrides,
    } as User);

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
    it('should create an order with order items and computed total amount', async () => {
      const createOrderDto = {
        petIds: ['pet1', 'pet2'],
        city: faker.location.city(),
        address: faker.location.streetAddress(),
        phoneNumber: faker.phone.number(),
      };
      const user = buildUser();

      const pet1 = buildPet({ id: 'pet1', price: 100 });
      const pet2 = buildPet({ id: 'pet2', price: 200 });

      (mockPetsService.findOne as jest.Mock).mockImplementation((id) => {
        if (id === 'pet1') return Promise.resolve(pet1);
        if (id === 'pet2') return Promise.resolve(pet2);
        return Promise.resolve(null);
      });
      (mockPetsService.update as jest.Mock).mockResolvedValue(undefined);

      const orderItem1 = { price: 100, pet: pet1 };
      const orderItem2 = { price: 200, pet: pet2 };
      (mockOrderItemRepository.create as jest.Mock).mockImplementation(
        (dto) => dto,
      );

      const order = {
        id: faker.string.uuid(),
        city: createOrderDto.city,
        address: createOrderDto.address,
        phoneNumber: createOrderDto.phoneNumber,
      };
      (mockOrderRepository.create as jest.Mock).mockReturnValue(order);
      (mockOrderRepository.save as jest.Mock).mockImplementation((o) =>
        Promise.resolve(o),
      );

      const result = await service.create(createOrderDto, user);

      // Each pet is fetched once
      expect(mockPetsService.findOne).toHaveBeenCalledTimes(2);
      expect(mockPetsService.findOne).toHaveBeenNthCalledWith(1, 'pet1');
      expect(mockPetsService.findOne).toHaveBeenNthCalledWith(2, 'pet2');

      // Each pet is marked unavailable
      expect(mockPetsService.update).toHaveBeenCalledTimes(2);
      expect(mockPetsService.update).toHaveBeenNthCalledWith(1, 'pet1', {
        isAvailable: false,
      });
      expect(mockPetsService.update).toHaveBeenNthCalledWith(2, 'pet2', {
        isAvailable: false,
      });

      // OrderItems created
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
        city: createOrderDto.city,
        address: createOrderDto.address,
        phoneNumber: createOrderDto.phoneNumber,
      });
      expect(mockOrderRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          user,
          orderItems: [orderItem1, orderItem2],
          totalAmount: 300,
        }),
      );
      expect(result.totalAmount).toBe(300);
      expect(result.user).toBe(user);
    });

    it('should throw BadRequestException if a pet is not available', async () => {
      const createOrderDto = {
        petIds: ['pet1'],
        city: faker.location.city(),
        address: faker.location.streetAddress(),
        phoneNumber: faker.phone.number(),
      };
      const user = buildUser();
      const pet1 = buildPet({ id: 'pet1', isAvailable: false });

      (mockPetsService.findOne as jest.Mock).mockResolvedValue(pet1);

      await expect(service.create(createOrderDto, user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not persist the order if any pet is unavailable', async () => {
      const createOrderDto = {
        petIds: ['pet1', 'pet2'],
        city: faker.location.city(),
        address: faker.location.streetAddress(),
        phoneNumber: faker.phone.number(),
      };
      const user = buildUser();

      const pet1 = buildPet({ id: 'pet1', isAvailable: true });
      const pet2 = buildPet({ id: 'pet2', isAvailable: false });

      (mockPetsService.findOne as jest.Mock).mockImplementation((id) =>
        Promise.resolve(id === 'pet1' ? pet1 : pet2),
      );
      (mockPetsService.update as jest.Mock).mockResolvedValue(undefined);
      (mockOrderItemRepository.create as jest.Mock).mockImplementation(
        (dto) => dto,
      );
      (mockOrderRepository.create as jest.Mock).mockReturnValue({});

      await expect(service.create(createOrderDto, user)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockOrderRepository.save).not.toHaveBeenCalled();
    });

    it('should fetch each pet by its id', async () => {
      const createOrderDto = {
        petIds: ['a', 'b', 'c'],
        city: 'City',
        address: 'Address',
        phoneNumber: '123',
      };
      const user = buildUser();

      (mockPetsService.findOne as jest.Mock).mockImplementation((id) =>
        Promise.resolve(buildPet({ id, price: 10 })),
      );
      (mockPetsService.update as jest.Mock).mockResolvedValue(undefined);
      (mockOrderItemRepository.create as jest.Mock).mockImplementation(
        (dto) => dto,
      );
      (mockOrderRepository.create as jest.Mock).mockReturnValue({});
      (mockOrderRepository.save as jest.Mock).mockImplementation((o) =>
        Promise.resolve(o),
      );

      await service.create(createOrderDto, user);

      expect(mockPetsService.findOne).toHaveBeenNthCalledWith(1, 'a');
      expect(mockPetsService.findOne).toHaveBeenNthCalledWith(2, 'b');
      expect(mockPetsService.findOne).toHaveBeenNthCalledWith(3, 'c');
    });
  });

  describe('findAll', () => {
    it('should return all orders', async () => {
      const orders = [{ id: faker.string.uuid() }, { id: faker.string.uuid() }];
      (mockOrderRepository.find as jest.Mock).mockResolvedValue(orders);

      const result = await service.findAll();

      expect(mockOrderRepository.find).toHaveBeenCalled();
      expect(result).toEqual(orders);
    });

    it('should return an empty array when there are no orders', async () => {
      (mockOrderRepository.find as jest.Mock).mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('findAllUserOrders', () => {
    it('should return all orders belonging to a user', async () => {
      const userId = faker.string.uuid();
      const orders = [{ id: faker.string.uuid() }];
      (mockOrderRepository.find as jest.Mock).mockResolvedValue(orders);

      const result = await service.findAllUserOrders(userId);

      expect(mockOrderRepository.find).toHaveBeenCalledWith({
        where: { user: { id: userId } },
      });
      expect(result).toEqual(orders);
    });

    it('should return an empty array if user has no orders', async () => {
      (mockOrderRepository.find as jest.Mock).mockResolvedValue([]);
      const result = await service.findAllUserOrders(faker.string.uuid());
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return an order if found', async () => {
      const id = faker.string.uuid();
      const order = { id };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);

      const result = await service.findOne(id);

      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id },
      });
      expect(result).toEqual(order);
    });

    it('should throw NotFoundException if order not found', async () => {
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(faker.string.uuid())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should merge provided options with the where clause', async () => {
      const id = faker.string.uuid();
      const order = { id };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);

      await service.findOne(id, { relations: { orderItems: true } });

      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        relations: { orderItems: true },
        where: { id },
      });
    });
  });

  describe('findUserOrder', () => {
    it('should return the order when it belongs to the user', async () => {
      const userId = faker.string.uuid();
      const order = {
        id: faker.string.uuid(),
        user: { id: userId },
        orderItems: [],
      };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);

      const user = buildUser({ id: userId });
      const result = await service.findUserOrder(order.id, user);

      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: order.id },
        relations: { user: true, orderItems: true },
      });
      expect(result).toEqual(order);
    });

    it('should allow an admin to view any order', async () => {
      const order = {
        id: faker.string.uuid(),
        user: { id: faker.string.uuid() },
        orderItems: [],
      };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);

      const admin = buildUser({ admin: true });
      const result = await service.findUserOrder(order.id, admin);

      expect(result).toEqual(order);
    });

    it('should throw NotFoundException if order not found', async () => {
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        service.findUserOrder(faker.string.uuid(), buildUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if order belongs to another user', async () => {
      const order = {
        id: faker.string.uuid(),
        user: { id: faker.string.uuid() },
      };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);

      await expect(
        service.findUserOrder(order.id, buildUser()),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('update', () => {
    it('should update and save an order if found', async () => {
      const id = faker.string.uuid();
      const order = {
        id,
        city: 'Old City',
        address: 'Old Address',
        phoneNumber: '1111111111',
      };
      const updateOrderDto = {
        city: 'New City',
        address: 'New Address',
      };
      const updatedOrder = { ...order, ...updateOrderDto };

      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);
      (mockOrderRepository.save as jest.Mock).mockResolvedValue(updatedOrder);

      const result = await service.update(id, updateOrderDto);

      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id },
      });
      expect(mockOrderRepository.save).toHaveBeenCalledWith(updatedOrder);
      expect(result).toEqual(updatedOrder);
    });

    it('should throw NotFoundException if order not found', async () => {
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(faker.string.uuid(), { city: 'New City' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should preserve fields that are not part of the update', async () => {
      const id = faker.string.uuid();
      const order = {
        id,
        city: 'Old City',
        address: 'Old Address',
        phoneNumber: '1111111111',
      };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);
      (mockOrderRepository.save as jest.Mock).mockImplementation((o) =>
        Promise.resolve(o),
      );

      const result = await service.update(id, { city: 'New City' });

      expect(result.city).toBe('New City');
      expect(result.address).toBe('Old Address');
      expect(result.phoneNumber).toBe('1111111111');
    });

    it('should allow updating order status and payment status', async () => {
      const id = faker.string.uuid();
      const order = { id, orderStatus: OrderStatus.PENDING };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);
      (mockOrderRepository.save as jest.Mock).mockImplementation((o) =>
        Promise.resolve(o),
      );

      const result = await service.update(id, {
        orderStatus: OrderStatus.SHIPPED,
        paymentStatus: PaymentStatus.PAID,
      });

      expect(result.orderStatus).toBe(OrderStatus.SHIPPED);
      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
    });
  });

  describe('remove', () => {
    it('should remove an order if found', async () => {
      const id = faker.string.uuid();
      const order = { id };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);
      (mockOrderRepository.delete as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      await service.remove(id);

      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id },
      });
      expect(mockOrderRepository.delete).toHaveBeenCalledWith(order);
    });

    it('should throw NotFoundException if order not found', async () => {
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.remove(faker.string.uuid())).rejects.toThrow(
        NotFoundException,
      );
      expect(mockOrderRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('markAsProcessing', () => {
    it('should set order status to PROCESSING and assign payment method', async () => {
      const id = faker.string.uuid();
      const order = {
        id,
        orderStatus: OrderStatus.PENDING,
        paymentMethod: null,
      };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);
      (mockOrderRepository.save as jest.Mock).mockImplementation((o) =>
        Promise.resolve(o),
      );

      const result = await service.markAsProcessing(id, PaymentMethod.CARD);

      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id },
      });
      expect(order.orderStatus).toBe(OrderStatus.PROCESSING);
      expect(order.paymentMethod).toBe(PaymentMethod.CARD);
      expect(mockOrderRepository.save).toHaveBeenCalledWith(order);
      expect(result).toEqual(order);
    });

    it('should accept CASH_ON_DELIVERY as the payment method', async () => {
      const id = faker.string.uuid();
      const order = { id, orderStatus: OrderStatus.PENDING, paymentMethod: PaymentMethod.CASH_ON_DELIVERY };
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(order);
      (mockOrderRepository.save as jest.Mock).mockImplementation((o) =>
        Promise.resolve(o),
      );

      await service.markAsProcessing(id, PaymentMethod.CASH_ON_DELIVERY);

      expect(order.paymentMethod).toBe(PaymentMethod.CASH_ON_DELIVERY);
    });

    it('should throw NotFoundException if order not found', async () => {
      (mockOrderRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.markAsProcessing(faker.string.uuid(), PaymentMethod.CARD),
      ).rejects.toThrow(NotFoundException);
    });
  });
});