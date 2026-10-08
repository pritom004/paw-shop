import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Length(3, 50)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 50, { message: 'Password must be between 8 and 50 characters' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message:
      'Password must contain at least 1 letter, one number and one special character',
  })
  @IsNotEmpty()
  password!: string;
}
