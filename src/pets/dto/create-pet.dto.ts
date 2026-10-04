import { Transform } from "class-transformer";
import {IsString, IsOptional, Length, IsNumber, MinLength, IsNotEmpty, IsBoolean, Min, IsArray} from "class-validator";

export class CreatePetDto {

    @IsString()
    @Length(3, 50, {message: "Name must be between 3 and 50 characters"})
    name!: string;

    @IsNumber()
    @Min(1, {message: "Price must be greater then zero"})
    @Transform(({value}) => parseFloat(value))
    price!: number;

    @IsString()
    @Length(3, 50, {message: "Breed must be between 3 and 50 characters"})
    breed!: string;
    
    @IsNumber()
    @Transform(({value}) => parseFloat(value))
    age!: number;

    @IsString()
    @IsNotEmpty({message: "City is required"})
    city!: string;

    @IsString()
    @IsNotEmpty({message: "Address is required"})
    address!: string;

    @IsArray()
    @IsString({each: true})
    @IsOptional()
    images?: string[];

    @IsString()
    @IsOptional()
    description?: string;

    @IsBoolean()
    @IsOptional()
    isAvailable?: boolean;

    @IsString()
    @MinLength(3, {message: "Slug must be at lest 3 characters long"})
    slug!: string;
}
