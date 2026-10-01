import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Pet } from '../../pets/entities/pet.entity';
import { Order } from '../../orders/entities/order.entity';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  @Exclude()
  password!: string;

  @Column({ default: false })
  @Exclude()
  admin!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Pet, (pet) => pet.user)
  pets!: Pet[];

  @OneToMany(() => Order, (order) => order.user)
  orders!: Order[];
}
