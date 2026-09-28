import {
  PrimaryGeneratedColumn,
  Column,
  Entity,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';

@Entity('pets')
export class Pet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column()
  breed!: string;

  @Column()
  age!: number;

  @Column({ unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: true })
  isAvailable!: boolean;

  @Column()
  city!: string;

  @Column()
  address!: string;

@Column({
  type: 'text',
  transformer: {
    to: (value: string[] | null) => (value ? JSON.stringify(value) : null),
    from: (value: string | null) => {
      if (!value) return [];
      try {
        return JSON.parse(value);
      } catch {
        return []; 
      }
    }
  }
})
images!: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @JoinColumn({
    name: "user_id"
  })
  @ManyToOne(() => User, user => user.pets)
  user!: User

  @OneToMany(() => OrderItem, (orderItem) => orderItem.pet)
  orderItems!: OrderItem[]

}
