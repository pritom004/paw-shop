import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class FindAllPetsDto {
  @IsString()
  @IsOptional()
  breed!: string;

  @IsString()
  @IsOptional()
  city!: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  minPrice!: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  maxPrice!: number;
}
