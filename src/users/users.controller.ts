import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Session,
  Delete,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login-dto';
import { Serialize } from './interceptors/serialize.interceptor';
import { UserDto } from './dto/user.dto';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from './decorators/current-user.decorator';
import { AdminGuard } from 'src/guards/admin.guard';

@Serialize(UserDto)
@Controller('users')
@Throttle({
  default: { ttl: 6000, limit: 3 },
})
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Post('/register')
  register(@Body() body: CreateUserDto) {
    return this.authService.register(body.name, body.email, body.password);
  }

  @Post('/login')
  async login(@Body() body: LoginDto, @Session() session: any) {
    const { email, password } = body;

    const user = await this.authService.login(email, password);

    session.userId = user.id;

    return user;
  }

  @Post('/logout')
  logout(@Session() session: any) {
    session.userId = null;
  }

  @Get('/whoami')
  whoami(@CurrentUser() user: any) {
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return user;
  }

  // Administrator Routes

  @UseGuards(AdminGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  removeUser(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
