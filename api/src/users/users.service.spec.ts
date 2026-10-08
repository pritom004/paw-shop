import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { faker } from '@faker-js/faker';

describe('UsersService', () => {
  let service: UsersService;
  let mockRepository: Partial<Repository<User>>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a user', async () => {
      const createUserDto = {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: 'hashed',
      };
      const user = { id: faker.string.uuid(), ...createUserDto };

      (mockRepository.create as jest.Mock).mockReturnValue(createUserDto);
      (mockRepository.save as jest.Mock).mockResolvedValue(user);

      const result = await service.create(createUserDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createUserDto);
      expect(mockRepository.save).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(user);
    });
  });

  describe('findAll', () => {
    it('should return users by email', async () => {
      const email = faker.internet.email();
      const users = [{ id: faker.string.uuid(), email }];
      (mockRepository.find as jest.Mock).mockResolvedValue(users);

      const result = await service.findAll(email);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { email },
      });
      expect(result).toEqual(users);
    });
  });

  describe('findOne', () => {
    it('should return a user if found', async () => {
      const id = faker.string.uuid();
      const user = { id, email: faker.internet.email() };
      (mockRepository.findOne as jest.Mock).mockResolvedValue(user);

      const result = await service.findOne(id);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id },
      });
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException if user not found', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(faker.string.uuid())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update and save a user if found', async () => {
      const id = faker.string.uuid();
      const user = {
        id,
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: 'hashed',
      };
      const updateUserDto = { name: faker.person.fullName() };
      const updatedUser = { ...user, ...updateUserDto };

      (mockRepository.findOne as jest.Mock).mockResolvedValue(user);
      (mockRepository.save as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.update(id, updateUserDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id },
      });
      expect(mockRepository.save).toHaveBeenCalledWith(updatedUser);
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(faker.string.uuid(), { name: 'Jane' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a user if found', async () => {
      const id = faker.string.uuid();
      const user = { id, email: faker.internet.email() };
      (mockRepository.findOne as jest.Mock).mockResolvedValue(user);
      (mockRepository.remove as jest.Mock).mockResolvedValue(user);

      const result = await service.remove(id);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id },
      });
      expect(mockRepository.remove).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException if user not found', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.remove(faker.string.uuid())).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});