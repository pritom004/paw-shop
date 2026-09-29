import {Column, Entity, PrimaryGeneratedColumn, ManyToOne} from "typeorm";
import { Order } from "./order.entity";
import { Pet } from "../../pets/entities/pet.entity";


@Entity()
export class OrderItem {

    @PrimaryGeneratedColumn()
    id!: string;

    price!: number;

    @ManyToOne(() => Order, (order) => order.orderItems)
    order!: Order;

    @ManyToOne(() => Pet, (pet) => pet.orderItems)
    pet!: Pet;

}