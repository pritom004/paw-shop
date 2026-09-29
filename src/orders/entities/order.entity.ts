import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OrderItem } from './order-item.entity';

enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELED = 'CANCELED',
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'decimal' })
  totalAmount!: number;

  @Column({
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  orderStatus!: string;

  @Column()
  city!: string;

  @Column()
  address!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column()
  phoneNumber!: string;

  @JoinColumn({name: "user_id"})
  @ManyToOne(() => User, (user) => user.orders)
  user!: User;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, {cascade: true})
  orderItems!: OrderItem[];

}
