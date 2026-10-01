import {
  Module,
  ValidationPipe,
  NestModule,
  MiddlewareConsumer,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { PetsModule } from './pets/pets.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/entities/user.entity';
import { Pet } from './pets/entities/pet.entity';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { OrdersModule } from './orders/orders.module';
import { OrderItem } from './orders/entities/order-item.entity';
import { Order } from './orders/entities/order.entity';
import { PaymentsModule } from './payments/payments.module';

const cookieSession = require('cookie-session');

@Module({
  imports: [
    UsersModule,
    PetsModule,
    ThrottlerModule.forRoot({throttlers: [{ ttl: 6000, limit: 100 }]}),
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV}`,
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        return {
          type: 'better-sqlite3',
          database: configService.get<string>('DATABASE_URL'),
          synchronize: true,
          entities: [User, Pet, Order, OrderItem],
        };
      },
      inject: [ConfigService],
    }),
    OrdersModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true }),
    },

    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector) => {
        return new ClassSerializerInterceptor(reflector)
      },
      inject: [Reflector]
    }
  ],
})
export class AppModule implements NestModule {
  constructor(private configService: ConfigService) {}
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        cookieSession({
          keys: [this.configService.get('SESSION_SECRET')],
          maxAge: 3 * 24 * 60 * 60 * 1000,
        }),
      )
      .forRoutes('*');
  }
}
