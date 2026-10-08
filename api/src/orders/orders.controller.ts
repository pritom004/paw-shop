import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  Session,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CurrentUser } from '../users/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AuthGuard } from '../guards/auth.guard';
import { AdminGuard } from '../guards/admin.guard';

@UseGuards(AuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: User) {
    return this.ordersService.create(createOrderDto, user);
  }

  @Get('/all')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  findAll() {
    return this.ordersService.findAll();
  }

  @Get('/')
  @HttpCode(200)
  findAllUserOrders(@CurrentUser() user: User) {
    return this.ordersService.findAllUserOrders(user.id);
  }

  @Get(':id')
  @HttpCode(200)
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ordersService.findUserOrder(id, user);
  }

  @Patch(':id')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}
