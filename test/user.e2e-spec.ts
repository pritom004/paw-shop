import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('UserController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });
  const email = 'example1@email.com';

  it('/ (POST) - handles a signup request', async () => {
    return request(app.getHttpServer())
      .post('/users/register')
      .send({
        name: 'Pritom',
        email,
        password: 'Sswsefw3frwafae3@',
      })
      .expect(201)
      .then((res) => {
        const { email, name, id } = res.body;

        expect(email).toEqual(email);
        expect(name).toEqual(name);
        expect(id).toBeDefined();
      });
  });

  it('/ (POST) - handles a login request', async () => {
    await request(app.getHttpServer()).post('/users/register').send({
      name: 'Pritom',
      email,
      password: 'Sswsefw3frwafae3@',
    });

    return request(app.getHttpServer())
      .post('/users/login')
      .send({
        email,
        password: 'Sswsefw3frwafae3@',
      })
      .expect(200)
      .then((res) => {
        const { email, name, id } = res.body;
        expect(email).toEqual(email);
        expect(name).toEqual(name);
        expect(id).toBeDefined();
      });
  });

  it('/ (POST) - returns user profile', async () => {
    await request(app.getHttpServer()).post('/users/register').send({
      name: 'Pritom',
      email,
      password: 'Sswsefw3frwafae3@',
    });

    const res = await request(app.getHttpServer()).post('/users/login').send({
      email,
      password: 'Sswsefw3frwafae3@',
    });

    const cookie = res.get('Set-Cookie')!;

    return request(app.getHttpServer())
      .get('/users/whoami')
      .set('Cookie', cookie)
      .expect(200)
      .then((res) => {
        const { id, name, email } = res.body;

        expect(id).toBeDefined();
        expect(name).toBeDefined();
        expect(email).toBeDefined();
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
