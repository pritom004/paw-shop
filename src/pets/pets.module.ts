import { Module } from '@nestjs/common';
import { PetsService } from './pets.service';
import { PetsController } from './pets.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pet } from './entities/pet.entity';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from 'src/guards/auth.guard';

@Module({
  controllers: [PetsController],
  providers: [PetsService, {provide: APP_GUARD, useClass: AuthGuard}],
  imports: [TypeOrmModule.forFeature([Pet])]
})
export class PetsModule {}
