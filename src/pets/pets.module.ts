import { Module } from '@nestjs/common';
import { PetsService } from './pets.service';
import { PetsController } from './pets.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pet } from './entities/pet.entity';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '../guards/auth.guard';

@Module({
  controllers: [PetsController],
  providers: [PetsService],
  imports: [TypeOrmModule.forFeature([Pet])]
})
export class PetsModule {}
