import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { FindAllPetsDto } from './dto/find-all-pets.dto';
import { AuthGuard } from '../guards/auth.guard';
import { CurrentUser } from '../users/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(AuthGuard)
@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Post()
  create(@Body() createPetDto: CreatePetDto, @CurrentUser() user: User) {
    
    return this.petsService.create(createPetDto, user);
  }

  @Get()
  findAll(@Query() query: FindAllPetsDto) {

    return this.petsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.petsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePetDto: UpdatePetDto) {
    return this.petsService.update(id, updatePetDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.petsService.remove(id);
  }
}
