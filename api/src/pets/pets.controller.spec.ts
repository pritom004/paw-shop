import { Test, TestingModule } from '@nestjs/testing';
import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';
import { faker } from '@faker-js/faker';
import { User } from '../users/entities/user.entity';

describe('PetsController', () => {
  let controller: PetsController;
  let mockPetsService: Partial<PetsService>;

  beforeEach(async () => {
    mockPetsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      updateUserPet: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PetsController],
      providers: [{ provide: PetsService, useValue: mockPetsService }],
    }).compile();

    controller = module.get<PetsController>(PetsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call petsService.create with correct arguments', async () => {
      const createPetDto = {
        name: faker.animal.cat(),
        price: 100,
        breed: faker.animal.cat(),
        age: 2,
        city: faker.location.city(),
        address: faker.location.streetAddress(),
        slug: faker.lorem.slug(),
      };
      const user = { id: faker.string.uuid() } as User;
      const pet = { id: faker.string.uuid(), ...createPetDto, user };
      (mockPetsService.create as jest.Mock).mockResolvedValue(pet);

      const result = await controller.create(createPetDto, user);

      expect(mockPetsService.create).toHaveBeenCalledWith(createPetDto, user);
      expect(result).toEqual(pet);
    });
  });

  describe('findAll', () => {
    it('should call petsService.findAll with query', async () => {
      const query = { name: 'Fluffy', limit: 10 };
      const pets = [{ id: faker.string.uuid() }];
      (mockPetsService.findAll as jest.Mock).mockResolvedValue(pets);

      const result = await controller.findAll(query);

      expect(mockPetsService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(pets);
    });
  });

  describe('findOne', () => {
    it('should call petsService.findOne with id', async () => {
      const id = faker.string.uuid();
      const pet = { id, name: faker.animal.cat() };
      (mockPetsService.findOne as jest.Mock).mockResolvedValue(pet);

      const result = await controller.findOne(id);

      expect(mockPetsService.findOne).toHaveBeenCalledWith(id);
      expect(result).toEqual(pet);
    });
  });

  describe('update', () => {
    it('should call petsService.updateUserPet with correct arguments', async () => {
      const id = faker.string.uuid();
      const updatePetDto = { name: 'New Name' };
      const user = { id: faker.string.uuid() } as User;
      const updatedPet = { id, name: 'New Name', user };
      (mockPetsService.updateUserPet as jest.Mock).mockResolvedValue(
        updatedPet,
      );

      const result = await controller.update(id, updatePetDto, user);

      expect(mockPetsService.updateUserPet).toHaveBeenCalledWith(
        id,
        updatePetDto,
        user,
      );
      expect(result).toEqual(updatedPet);
    });
  });

  describe('remove', () => {
    it('should call petsService.remove with correct arguments', async () => {
      const id = faker.string.uuid();
      const user = { id: faker.string.uuid() } as User;
      const removedPet = { id, name: faker.animal.cat() };
      (mockPetsService.remove as jest.Mock).mockResolvedValue(removedPet);

      const result = await controller.remove(id, user);

      expect(mockPetsService.remove).toHaveBeenCalledWith(id, user);
      expect(result).toEqual(removedPet);
    });
  });
});