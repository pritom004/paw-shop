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
import { Pet } from '../pets/entities/pet.entity'; // <- adjust path if different
import { DataSource, EntityManager, Repository } from 'typeorm';
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
  let mockManager: Partial<EntityManager>;
  let mockDataSource: Partial<DataSource>;

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
    }) as User;

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

    // ---- mock EntityManager used inside the transaction ----
    mockManager = {
      findOne: jest.fn(),
      // default: pretend the atomic "reserve pet" update succeeded
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      // manager.create(Entity, dto) -> just return the dto
      create: jest.fn((_entity: any, dto: any) => ({ ...dto })),
      // manager.save(entity) -> return it back
      save: jest.fn((entity: any) => Promise.resolve(entity)),
    };

    // ---- mock DataSource that runs the callback with mockManager ----
    mockDataSource = {
      transaction: jest.fn((cb: any) => cb(mockManager)),
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
        // @InjectDataSource() with no name resolves to the DataSource class token
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================
  // create()
  // ============================================================
  describe('create', () => {
    it('should run the whole order creation inside a transaction', async () => {
      const createOrderDto = {
        petIds: ['pet1'],
        city: faker.location.city(),
        address: faker.location.streetAddress(),
        phoneNumber: faker.phone.number(),
      };
      const user = buildUser();
      const pet1 = buildPet({ id: 'pet1', price: 100 });

      (mockManager.findOne as jest.Mock).mockResolvedValue(pet1);

      await service.create(createOrderDto, user);

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      // ensure the callback got an EntityManager
      expect((mockDataSource.transaction as jest.Mock).mock.calls[0][0]).toEqual(
        expect.any(Function),
      );
    });

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

      (mockManager.findOne as jest.Mock).mockImplementation(
        (_entity, opts: any) => {
          const id = opts.where.id;
          if (id === 'pet1') return Promise.resolve(pet1);
          if (id === 'pet2') return Promise.resolve(pet2);
          return Promise.resolve(null);
        },
      );

      const result = await service.create(createOrderDto, user);

      // Each pet is fetched via the manager inside the transaction
      expect(mockManager.findOne).toHaveBeenCalledTimes(2);
      expect(mockManager.findOne).toHaveBeenNthCalledWith(1, Pet, {
        where: { id: 'pet1' },
      });
      expect(mockManager.findOne).toHaveBeenNthCalledWith(2, Pet, {
        where: { id: 'pet2' },
      });

      // Atomic check-and-reserve on each pet
      expect(mockManager.update).toHaveBeenCalledTimes(2);
      expect(mockManager.update).toHaveBeenNthCalledWith(
        1,
        Pet,
        { id: 'pet1', isAvailable: true },
        { isAvailable: false },
      );
      expect(mockManager.update).toHaveBeenNthCalledWith(
        2,
        Pet,
        { id: 'pet2', isAvailable: true },
        { isAvailable: false },
      );

      // manager.create called for Order + 2 OrderItems
      expect(mockManager.create).toHaveBeenCalledTimes(3);
      expect(mockManager.create).toHaveBeenNthCalledWith(1, Order, {
        city: createOrderDto.city,
        address: createOrderDto.address,
        phoneNumber: createOrderDto.phoneNumber,
      });
      expect(mockManager.create).toHaveBeenNthCalledWith(2, OrderItem, {
        price: 100,
        pet: pet1,
      });
      expect(mockManager.create).toHaveBeenNthCalledWith(3, OrderItem, {
        price: 200,
        pet: pet2,
      });

      // save called with the enriched order
      expect(mockManager.save).toHaveBeenCalledTimes(1);
      expect(mockManager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          city: createOrderDto.city,
          address: createOrderDto.address,
          phoneNumber: createOrderDto.phoneNumber,
          user,
          orderItems: [
            { price: 100, pet: pet1 },
            { price: 200, pet: pet2 },
          ],
          totalAmount: 300,
        }),
      );

      expect(result.totalAmount).toBe(300);
      expect(result.user).toBe(user);
    });

    it('should throw BadRequestException if a pet is no longer available', async () => {
      const createOrderDto = {
        petIds: ['pet1'],
        city: faker.location.city(),
        address: faker.location.streetAddress(),
        phoneNumber: faker.phone.number(),
      };
      const user = buildUser();
      const pet1 = buildPet({ id: 'pet1' });

      // Pet still exists...
      (mockManager.findOne as jest.Mock).mockResolvedValue(pet1);
      // ...but the atomic reserve update affected 0 rows (someone beat us).
      (mockManager.update as jest.Mock).mockResolvedValue({ affected: 0 });

      await expect(service.create(createOrderDto, user)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if a pet does not exist', async () => {
      const createOrderDto = {
        petIds: ['ghost'],
        city: faker.location.city(),
        address: faker.location.streetAddress(),
        phoneNumber: faker.phone.number(),
      };
      const user = buildUser();

      (mockManager.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.create(createOrderDto, user)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockManager.update).not.toHaveBeenCalled();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should not persist the order if any pet is unavailable', async () => {
      const createOrderDto = {
        petIds: ['pet1', 'pet2'],
        city: faker.location.city(),
        address: faker.location.streetAddress(),
        phoneNumber: faker.phone.number(),
      };
      const user = buildUser();

      const pet1 = buildPet({ id: 'pet1' });
      const pet2 = buildPet({ id: 'pet2' });

      (mockManager.findOne as jest.Mock).mockImplementation(
        (_entity, opts: any) =>
          Promise.resolve(opts.where.id === 'pet1' ? pet1 : pet2),
      );
      // First pet reserves fine, second one loses the race.
      (mockManager.update as jest.Mock)
        .mockResolvedValueOnce({ affected: 1 })
        .mockResolvedValueOnce({ affected: 0 });

      await expect(service.create(createOrderDto, user)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('should fetch each pet by its id', async () => {
      const createOrderDto = {
        petIds: ['a', 'b', 'c'],
        city: 'City',
        address: 'Address',
        phoneNumber: '123',
      };
      const user = buildUser();

      (mockManager.findOne as jest.Mock).mockImplementation(
        (_entity, opts: any) =>
          Promise.resolve(buildPet({ id: opts.where.id, price: 10 })),
      );

      await service.create(createOrderDto, user);

      expect(mockManager.findOne).toHaveBeenNthCalledWith(1, Pet, {
        where: { id: 'a' },
      });
      expect(mockManager.findOne).toHaveBeenNthCalledWith(2, Pet, {
        where: { id: 'b' },
      });
      expect(mockManager.findOne).toHaveBeenNthCalledWith(3, Pet, {
        where: { id: 'c' },
      });
    });

    it('should de-duplicate petIds so a pet cannot appear twice', async () => {
      const createOrderDto = {
        petIds: ['pet1', 'pet1'],
        city: 'City',
        address: 'Address',
        phoneNumber: '123',
      };
      const user = buildUser();
      const pet1 = buildPet({ id: 'pet1', price: 50 });

      (mockManager.findOne as jest.Mock).mockResolvedValue(pet1);

      const result = await service.create(createOrderDto, user);

      expect(mockManager.findOne).toHaveBeenCalledTimes(1);
      expect(mockManager.update).toHaveBeenCalledTimes(1);
      expect(result.totalAmount).toBe(50);
    });
  });

  // ============================================================
  // The rest of the file is UNCHANGED
  // ============================================================
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
      const order = {
        id,
        orderStatus: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      };
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