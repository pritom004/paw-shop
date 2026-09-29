import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { faker } from '@faker-js/faker';
import { registerAndLogin } from './utils/auth';

let cookie: string[];
describe('OrderController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();


    const auth = await registerAndLogin(app);
    cookie = auth.cookie;
    
  });

  it('/ (POST) - create a pet order', async () => {
    const TOTAL_PET_COUNTS = 5;
    const createdPets = await Promise.all(
      Array.from({ length: TOTAL_PET_COUNTS }).map(() =>
        request(app.getHttpServer())
          .post('/pets')
          .set("Cookie", cookie)
          .send({
            name: faker.animal.petName(),
            price: faker.number.int(),
            breed: faker.animal.dog(),
            city: faker.location.city(),
            address: faker.location.streetAddress(),
            images: faker.helpers.multiple(() => faker.image.url()),
            age: faker.number.int(),
            slug: faker.helpers.slugify(faker.animal.dog())
          }),
      ),
    );

    
    const petIds = createdPets.map((pet) => pet.body.id) as Array<string>;


    const orderDetails = {
      petIds,
      city: 'Chittagong',
      address: '12 Agrabad Commercial Area, Chittagong',
      phoneNumber: '01712345678'
    };

    return request(app.getHttpServer())
    .post('/orders')
    .set("Cookie", cookie)
    .send(orderDetails)
    .expect(201)
    .then((res) => {
      
      const {id, city, address, phoneNumber, orderItems, user} = res.body;
      
      expect(id).toBeDefined();
      expect(city).toEqual(orderDetails.city);
      expect(address).toEqual(orderDetails.address);
      expect(phoneNumber).toEqual(orderDetails.phoneNumber);
      expect(orderItems.length).toEqual(TOTAL_PET_COUNTS);
      expect(user).toBeDefined()
      
    })



  });

  afterEach(async () => {
    await app.close();
  });
});
