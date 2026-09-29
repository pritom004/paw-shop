import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { faker } from '@faker-js/faker';

export async function registerAndLogin(
  app: INestApplication,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
) {
  const user = {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: 'Sswsefw3frwafae3@',
    ...overrides,
  };

  await request(app.getHttpServer()).post('/users/register').send(user).expect(201);

  const res = await request(app.getHttpServer())
    .post('/users/login')
    .send({ email: user.email, password: user.password })
    .expect(200);

  const cookie = res.get('Set-Cookie')!;
  return { cookie, user, id: res.body.id };
}