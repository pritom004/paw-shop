import {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ClassConstructor, plainToInstance } from 'class-transformer';


export function Serialize(dto: ClassConstructor<unknown>) {
  return UseInterceptors(new SerializeInterceptor(dto));
}

export class SerializeInterceptor implements NestInterceptor {
  constructor(private dto: ClassConstructor<unknown>) {}
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    return next.handle().pipe(
      map((user) =>
        plainToInstance(this.dto, user, {
          enableImplicitConversion: true,
        }),
      ),
    );
  }
}
