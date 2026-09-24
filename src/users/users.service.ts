import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async create(createUserDto: CreateUserDto) {



    const user = this.repo.create(createUserDto);

    return this.repo.save(user);
  }

  findAll(email: string) {
    return this.repo.find({
      where: {
        email
      }
    });
  }

  async findOne(id: string) {
    const user = await this.repo.findOne({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found!');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.repo.find({
      where: {id}
    })

    if(!user){
      throw new NotFoundException("User not found!");
    }

    Object.assign(user, updateUserDto);


    return this.repo.save(user);

  }

  async remove(id: string) {
    const user = await this.repo.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found!');
    }

    return this.repo.remove(user);
  }
}
