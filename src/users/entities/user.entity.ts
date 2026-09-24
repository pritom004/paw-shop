import {Column, PrimaryGeneratedColumn} from "typeorm";

export class User {
    @PrimaryGeneratedColumn()
    name!: string;

    @Column({unique: true})
    email!: string;

    @Column()
    password!: string;

    @Column()
    admin!: boolean;

}
