import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly userService: UsersService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    const { userId } = request.session;

    if (userId) {
      return false;
    }

    const user = await this.userService.findOne(userId);

    return user.admin;
  }
}
