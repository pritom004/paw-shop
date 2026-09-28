import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

export class AccountOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User authentication context not found.');
    }

    const accountIdFromRoute = request.params.id;

    const isOwner = String(user.id) === String(accountIdFromRoute);

    if (!isOwner) {
      throw new ForbiddenException(
        'You do not have permission to access or modify this account.',
      );
    }

    return true;
  }
}
