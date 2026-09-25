import { MiddlewareConsumer, Module, NestModule} from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import {User} from './entities/user.entity'
import { AuthService } from './auth.service';
import { CurrentUserMiddleware } from 'src/middlewares/current-user.middleware';



@Module({
  controllers: [UsersController],
  providers: [UsersService, AuthService],
  imports: [ TypeOrmModule.forFeature([User])]
})

export class UsersModule implements NestModule{
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CurrentUserMiddleware).forRoutes('*')
  }
}
