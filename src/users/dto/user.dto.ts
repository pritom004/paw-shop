import {Exclude} from "class-transformer";

export class UserDto {
  
    @Exclude()
    admin!: boolean;

    @Exclude()
    password!: string;
}