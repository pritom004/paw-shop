import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';
import {
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { faker } from '@faker-js/faker';

describe('AuthService', () => {
  let service: AuthService;
  let mockUsersService: Partial<UsersService>;

  beforeEach(async () => {
    mockUsersService = {
      findAll: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should hash password and create a new user', async () => {
      const name = faker.person.fullName();
      const email = faker.internet.email();
      const password = 'Password1!';
      const userId = faker.string.uuid();

      (mockUsersService.findAll as jest.Mock).mockResolvedValue([]);
      (mockUsersService.create as jest.Mock).mockImplementation((dto) =>
        Promise.resolve({ id: userId, ...dto }),
      );

      const result = await service.register(name, email, password);

      expect(mockUsersService.findAll).toHaveBeenCalledWith(email);
      expect(mockUsersService.create).toHaveBeenCalled();

      const createArg = (mockUsersService.create as jest.Mock).mock.calls[0][0];
      expect(createArg.name).toBe(name);
      expect(createArg.email).toBe(email);
      expect(createArg.password).toMatch(/^[a-f0-9]+\.[a-f0-9]+$/);

      expect(result).toEqual(
        expect.objectContaining({
          id: userId,
          name,
          email,
        }),
      );
    });

    it('should throw ConflictException if email is already in use', async () => {
      const email = faker.internet.email();
      (mockUsersService.findAll as jest.Mock).mockResolvedValue([
        { id: faker.string.uuid() },
      ]);

      await expect(
        service.register('John Doe', email, 'Password1!'),
      ).rejects.toThrow(ConflictException);
    });

    it('should not call create if email is already in use', async () => {
      const email = faker.internet.email();
      (mockUsersService.findAll as jest.Mock).mockResolvedValue([
        { id: faker.string.uuid() },
      ]);

      await expect(
        service.register('John Doe', email, 'Password1!'),
      ).rejects.toThrow(ConflictException);

      expect(mockUsersService.create).not.toHaveBeenCalled();
    });

    it('should generate different salts for the same password', async () => {
      const email1 = faker.internet.email();
      const email2 = faker.internet.email();
      const password = 'Password1!';

      (mockUsersService.findAll as jest.Mock).mockResolvedValue([]);
      (mockUsersService.create as jest.Mock).mockImplementation((dto) =>
        Promise.resolve({ id: faker.string.uuid(), ...dto }),
      );

      await service.register('User One', email1, password);
      await service.register('User Two', email2, password);

      const firstHash = (mockUsersService.create as jest.Mock).mock.calls[0][0]
        .password;
      const secondHash = (mockUsersService.create as jest.Mock).mock.calls[1][0]
        .password;

      expect(firstHash).not.toBe(secondHash);
    });
  });

  describe('login', () => {
    it('should return user when credentials are valid', async () => {
      const name = faker.person.fullName();
      const email = faker.internet.email();
      const password = 'Password1!';
      const userId = faker.string.uuid();

      // Register to obtain a valid hashed password
      (mockUsersService.findAll as jest.Mock).mockResolvedValue([]);
      (mockUsersService.create as jest.Mock).mockImplementation((dto) =>
        Promise.resolve({ id: userId, ...dto }),
      );

      const registeredUser = await service.register(name, email, password);
      const hashedPassword = registeredUser.password;

      const user = {
        id: userId,
        name,
        email,
        password: hashedPassword,
      };
      (mockUsersService.findAll as jest.Mock).mockResolvedValue([user]);

      const result = await service.login(email, password);
      expect(result).toEqual(user);
    });

    it('should throw BadRequestException if user not found', async () => {
      (mockUsersService.findAll as jest.Mock).mockResolvedValue([]);

      await expect(
        service.login(faker.internet.email(), 'Password1!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      const name = faker.person.fullName();
      const email = faker.internet.email();
      const password = 'Password1!';
      const userId = faker.string.uuid();

      (mockUsersService.findAll as jest.Mock).mockResolvedValue([]);
      (mockUsersService.create as jest.Mock).mockImplementation((dto) =>
        Promise.resolve({ id: userId, ...dto }),
      );

      const registeredUser = await service.register(name, email, password);
      const hashedPassword = registeredUser.password;

      const user = {
        id: userId,
        name,
        email,
        password: hashedPassword,
      };
      (mockUsersService.findAll as jest.Mock).mockResolvedValue([user]);

      await expect(
        service.login(email, 'WrongPassword1!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should return logout successful message', async () => {
      const result = await service.logout(faker.string.uuid());
      expect(result).toBe('Logout successful');
    });
  });
});