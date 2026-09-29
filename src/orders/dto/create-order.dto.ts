import { IsString, IsArray} from "class-validator";



export class CreateOrderDto {
    @IsArray()
    @IsString({each: true})
    petIds!: string[];

    @IsString()
    city!: string;


    @IsString()
    address!: string;

    @IsString()
    phoneNumber!: string;
}
