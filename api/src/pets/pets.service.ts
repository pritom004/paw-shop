import {
  ConflictException,
  ForbiddenException,
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

  private async findOwnedPet(id: string, user: User): Promise<Pet> {
  const pet = await this.petRepository.findOne({ where: { id } });

  if (!pet) throw new NotFoundException('Pet not found');

  if (pet.user.id !== user.id) {
    throw new ForbiddenException('You do not own this pet');
  }

  return pet;
}

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

    if (name !== undefined) {
      query.andWhere('pet.name LIKE :name', { name: `%${name}%` });
    }

    if (age !== undefined) {
      query.andWhere('pet.age = :age', { age });
    }

    if (minPrice !== undefined) {
      query.andWhere('pet.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      query.andWhere('pet.price <= :maxPrice', { maxPrice });
    }

    if (breed !== undefined) {
      query.andWhere('pet.breed LIKE :breed', { breed: `%${breed}%` });
    }

    if (city !== undefined) {
      query.andWhere('pet.city = :city', { city });
    }

    

    if (limit !== undefined) {
      query.limit(limit);
    }

    if (offset !== undefined) {
      query.offset(offset);
    }

    return query.getMany();
  }

  async findOne(id: string) {
    const pet = await this.petRepository.findOne({
      where: { id },
      relations: {
        user: true
      }
    });

    if (!pet) {
      throw new NotFoundException('Pet not found!');
    }

    return pet;
  }

  async updateUserPet(id: string, updatePetDto: UpdatePetDto, user: User) {
    const pet = await this.findOwnedPet(id, user)


    Object.assign(pet, updatePetDto);

    return this.petRepository.save(pet);
  }

  
  async update(id: string, updatePetDto: UpdatePetDto) {
    const pet = await this.petRepository.findOne({where: {id}})

    if(!pet){
      throw new NotFoundException("Pet not found!");
    }

    Object.assign(pet, updatePetDto);

    return this.petRepository.save(pet);
  }

  async remove(id: string, user: User) {
    const pet = await this.findOwnedPet(id, user);


    return this.petRepository.remove(pet);
  }
}
