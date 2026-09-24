import { Module, ValidationPipe } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { PetsModule } from './pets/pets.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/entities/user.entity';
import { Pet } from './pets/entities/pet.entity';
import { APP_PIPE } from '@nestjs/core';

@Module({
  imports: [
    UsersModule,
    PetsModule,
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
          entities: [User, Pet]
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, {provide: APP_PIPE, useValue: new ValidationPipe({whitelist: true, transform: true})}],
})
export class AppModule {}
