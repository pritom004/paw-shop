import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { scrypt as __scrypt, randomBytes as _randomBytes } from 'crypto';
import { promisify } from 'util';
const scrypt = promisify(__scrypt);
const randomBytes = promisify(_randomBytes);

@Injectable()
export class AuthService {
  constructor(private readonly userService: UsersService) {}

  private async hashPassword(password: string, salt?: string): Promise<string> {
    if (!salt) {
      const saltBuffer = (await randomBytes(16)) as Buffer;
      salt = saltBuffer.toString('hex');
    }

    const buffer = (await scrypt(password, salt, 64)) as Buffer;
    return `${buffer.toString('hex')}.${salt}`;
  }

  async register(name: string, email: string, password: string) {
    const hash = await this.hashPassword(password);

    const users = await this.userService.findAll(email);

    if (users.length !== 0) {
      throw new ConflictException('Email in use');
    }

    return this.userService.create({ name, email, password: hash });
  }

  async login(email: string, password: string) {
    const users = await this.userService.findAll(email);

    if (users.length === 0) {
      throw new NotFoundException('User not found!');
    }

    const user = users[0];

    const [storedHash, storedSalt] = user.password.split('.');

    const computedHash = (await this.hashPassword(password, storedSalt)).split(
      '.',
    )[0];

    if (storedHash !== computedHash) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    return user;
  }

  async logout(id: string) {
    // Todo: implement logout method

    return 'Logout successful';
  }
}
