import { Test, TestingModule } from '@nestjs/testing';
import { PetsService } from './pets.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Pet } from './entities/pet.entity';
import { Repository, QueryFailedError } from 'typeorm';
import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { User } from '../users/entities/user.entity';

describe('PetsService', () => {
  let service: PetsService;
  let mockPetRepository: Partial<Repository<Pet>>;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    mockPetRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetsService,
        { provide: getRepositoryToken(Pet), useValue: mockPetRepository },
      ],
    }).compile();

    service = module.get<PetsService>(PetsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a pet with the user', async () => {
      const user = { id: faker.string.uuid() } as User;
      const createPetDto = {
        name: faker.animal.cat(),
        price: faker.number.float({ min: 1, max: 1000 }),
        breed: faker.animal.cat(),
        age: faker.number.int({ min: 0, max: 20 }),
        city: faker.location.city(),
        address: faker.location.streetAddress(),
        slug: faker.lorem.slug(),
        images: [faker.image.url()],
        description: faker.lorem.sentence(),
        isAvailable: true,
      };
      const petInstance = { ...createPetDto, user };
      const savedPet = { id: faker.string.uuid(), ...petInstance };

      (mockPetRepository.create as jest.Mock).mockReturnValue(petInstance);
      (mockPetRepository.save as jest.Mock).mockResolvedValue(savedPet);

      const result = await service.create(createPetDto, user);

      expect(mockPetRepository.create).toHaveBeenCalledWith(createPetDto);
      expect(petInstance.user).toBe(user);
      expect(mockPetRepository.save).toHaveBeenCalledWith(petInstance);
      expect(result).toEqual(savedPet);
    });

    it('should throw ConflictException if slug already exists', async () => {
      const user = { id: faker.string.uuid() } as User;
      const createPetDto = { slug: 'duplicate' } as any;
      const queryFailedError = new QueryFailedError(
        'INSERT',
        [],
        new Error('duplicate key'),
      );

      (mockPetRepository.create as jest.Mock).mockReturnValue({});
      (mockPetRepository.save as jest.Mock).mockRejectedValue(
        queryFailedError,
      );

      await expect(service.create(createPetDto, user)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      const user = { id: faker.string.uuid() } as User;
      const createPetDto = { slug: 'test' } as any;
      const error = new Error('Some other error');

      (mockPetRepository.create as jest.Mock).mockReturnValue({});
      (mockPetRepository.save as jest.Mock).mockRejectedValue(error);

      await expect(service.create(createPetDto, user)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findAll', () => {
    it('should return pets with all filters applied', async () => {
      const findAllPetsDto = {
        name: 'Fluffy',
        age: 3,
        minPrice: 100,
        maxPrice: 500,
        breed: 'Persian',
        city: 'New York',
        limit: 10,
        offset: 0,
      };
      const pets = [{ id: faker.string.uuid() }];
      mockQueryBuilder.getMany.mockResolvedValue(pets);

      const result = await service.findAll(findAllPetsDto);

      expect(mockPetRepository.createQueryBuilder).toHaveBeenCalledWith('pet');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'pet.name LIKE :name',
        { name: `%${findAllPetsDto.name}%` },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'pet.age = :age',
        { age: findAllPetsDto.age },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'pet.price >= :minPrice',
        { minPrice: findAllPetsDto.minPrice },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'pet.price <= :maxPrice',
        { maxPrice: findAllPetsDto.maxPrice },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'pet.breed LIKE :breed',
        { breed: `%${findAllPetsDto.breed}%` },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'pet.city = :city',
        { city: findAllPetsDto.city },
      );
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(
        findAllPetsDto.limit,
      );
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(
        findAllPetsDto.offset,
      );
      expect(result).toEqual(pets);
    });

    it('should return all pets when no filters are provided', async () => {
      const findAllPetsDto = {};
      const pets = [{ id: faker.string.uuid() }];
      mockQueryBuilder.getMany.mockResolvedValue(pets);

      const result = await service.findAll(findAllPetsDto);

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(mockQueryBuilder.limit).not.toHaveBeenCalled();
      expect(mockQueryBuilder.offset).not.toHaveBeenCalled();
      expect(result).toEqual(pets);
    });
  });

  describe('findOne', () => {
    it('should return a pet if found', async () => {
      const id = faker.string.uuid();
      const pet = {
        id,
        name: faker.animal.cat(),
        user: { id: faker.string.uuid() },
      };
      (mockPetRepository.findOne as jest.Mock).mockResolvedValue(pet);

      const result = await service.findOne(id);

      expect(mockPetRepository.findOne).toHaveBeenCalledWith({
        where: { id },
        relations: { user: true },
      });
      expect(result).toEqual(pet);
    });

    it('should throw NotFoundException if pet not found', async () => {
      (mockPetRepository.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne(faker.string.uuid())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUserPet', () => {
    it('should update a pet owned by the user', async () => {
      const userId = faker.string.uuid();
      const user = { id: userId } as User;
      const petId = faker.string.uuid();
      const pet = { id: petId, name: 'Old', user: { id: userId } };
      const updatePetDto = { name: 'New' };
      const updatedPet = { ...pet, ...updatePetDto };

      (mockPetRepository.findOne as jest.Mock).mockResolvedValue(pet);
      (mockPetRepository.save as jest.Mock).mockResolvedValue(updatedPet);

      const result = await service.updateUserPet(petId, updatePetDto, user);

      expect(mockPetRepository.findOne).toHaveBeenCalledWith({
        where: { id: petId },
      });
      expect(mockPetRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(updatedPet),
      );
      expect(result).toEqual(updatedPet);
    });

    it('should throw NotFoundException if pet not found', async () => {
      const user = { id: faker.string.uuid() } as User;
      (mockPetRepository.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        service.updateUserPet(faker.string.uuid(), {}, user),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the pet', async () => {
      const user = { id: faker.string.uuid() } as User;
      const pet = {
        id: faker.string.uuid(),
        user: { id: faker.string.uuid() },
      };
      (mockPetRepository.findOne as jest.Mock).mockResolvedValue(pet);
      await expect(service.updateUserPet(pet.id, {}, user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should update a pet if found', async () => {
      const petId = faker.string.uuid();
      const pet = { id: petId, name: 'Old' };
      const updatePetDto = { name: 'New' };
      const updatedPet = { ...pet, ...updatePetDto };

      (mockPetRepository.findOne as jest.Mock).mockResolvedValue(pet);
      (mockPetRepository.save as jest.Mock).mockResolvedValue(updatedPet);

      const result = await service.update(petId, updatePetDto);

      expect(mockPetRepository.findOne).toHaveBeenCalledWith({
        where: { id: petId },
      });
      expect(mockPetRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(updatedPet),
      );
      expect(result).toEqual(updatedPet);
    });

    it('should throw NotFoundException if pet not found', async () => {
      (mockPetRepository.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.update(faker.string.uuid(), {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a pet owned by the user', async () => {
      const userId = faker.string.uuid();
      const user = { id: userId } as User;
      const petId = faker.string.uuid();
      const pet = { id: petId, user: { id: userId } };

      (mockPetRepository.findOne as jest.Mock).mockResolvedValue(pet);
      (mockPetRepository.remove as jest.Mock).mockResolvedValue(pet);

      const result = await service.remove(petId, user);

      expect(mockPetRepository.findOne).toHaveBeenCalledWith({
        where: { id: petId },
      });
      expect(mockPetRepository.remove).toHaveBeenCalledWith(pet);
      expect(result).toEqual(pet);
    });

    it('should throw NotFoundException if pet not found', async () => {
      const user = { id: faker.string.uuid() } as User;
      (mockPetRepository.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.remove(faker.string.uuid(), user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own the pet', async () => {
      const user = { id: faker.string.uuid() } as User;
      const pet = {
        id: faker.string.uuid(),
        user: { id: faker.string.uuid() },
      };
      (mockPetRepository.findOne as jest.Mock).mockResolvedValue(pet);
      await expect(service.remove(pet.id, user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});