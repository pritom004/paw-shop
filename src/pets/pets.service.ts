import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Pet } from './entities/pet.entity';
import { QueryFailedError, Repository } from 'typeorm';
import { FindAllPetsDto } from './dto/find-all-pets.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PetsService {
  constructor(
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
  ) {}

  async create(createPetDto: CreatePetDto, user: User) {
    try {
      const petInstance = this.petRepository.create(createPetDto);
      petInstance.user = user;
      const pet = await this.petRepository.save(petInstance);

      return pet;
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException('A pet with this slug already exists');
      } else {
        throw new InternalServerErrorException('Unaccepted server error');
      }
    }
  }

  async findAll(findAllPetsDto: FindAllPetsDto) {
    const { name, age, minPrice, maxPrice, breed, city, limit, offset } =
      findAllPetsDto;

    const query = this.petRepository.createQueryBuilder('pet');

    if (name) {
      query.andWhere('pet.name LIKE :name', { name: `%${name}%` });
    }

    if (age) {
      query.andWhere('pet.age = :age', { age });
    }

    if (minPrice) {
      query.andWhere('pet.price >= :minPrice', { minPrice });
    }

    if (maxPrice) {
      query.andWhere('pet.price <= :maxPrice', { maxPrice });
    }

    if (breed) {
      query.andWhere('pet.breed LIKE :breed', { breed: `%${breed}%` });
    }

    if (city) {
      query.andWhere('pet.city = city', { city });
    }

    if (limit) {
      query.limit(limit);
    }

    if (offset) {
      query.offset(offset);
    }

    return query.getMany();
  }

  async findOne(id: string) {
    const pet = await this.petRepository.findOne({
      where: { id },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found!');
    }

    return pet;
  }

  async update(id: string, updatePetDto: UpdatePetDto) {
    const pet = await this.petRepository.findOne({
      where: { id },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found!');
    }

    Object.assign(pet, updatePetDto);

    return pet;
  }

  async remove(id: string) {
    const pet = await this.petRepository.findOne({
      where: { id },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found!');
    }

    return this.petRepository.remove(pet);
  }
}
