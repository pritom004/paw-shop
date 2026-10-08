import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { faker } from '@faker-js/faker';

describe('UsersController', () => {
  let controller: UsersController;
  let mockUsersService: Partial<UsersService>;
  let mockAuthService: Partial<AuthService>;

  beforeEach(async () => {
    mockUsersService = {
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register with correct arguments', async () => {
      const body = {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: 'Password1!',
      };
      const user = { id: faker.string.uuid(), ...body };
      (mockAuthService.register as jest.Mock).mockResolvedValue(user);

      const result = await controller.register(body);

      expect(mockAuthService.register).toHaveBeenCalledWith(
        body.name,
        body.email,
        body.password,
      );
      expect(result).toEqual(user);
    });
  });

  describe('login', () => {
    it('should call authService.login, set session userId, and return user', async () => {
      const body = { email: faker.internet.email(), password: 'Password1!' };
      const user = { id: faker.string.uuid(), email: body.email };
      const session = { userId: null };
      (mockAuthService.login as jest.Mock).mockResolvedValue(user);

      const result = await controller.login(body, session);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        body.email,
        body.password,
      );
      expect(session.userId).toBe(user.id);
      expect(result).toEqual(user);
    });
  });

  describe('logout', () => {
    it('should clear session userId', () => {
      const session = { userId: faker.string.uuid() };
      controller.logout(session);
      expect(session.userId).toBeNull();
    });
  });

  describe('whoami', () => {
    it('should return the current user', () => {
      const user = { id: faker.string.uuid(), email: faker.internet.email() };
      const result = controller.whoami(user);
      expect(result).toEqual(user);
    });

    it('should throw UnauthorizedException if no user', () => {
      expect(() => controller.whoami(null)).toThrow(UnauthorizedException);
    });
  });

  describe('findOne', () => {
    it('should call usersService.findOne with id', async () => {
      const id = faker.string.uuid();
      const user = { id, email: faker.internet.email() };
      (mockUsersService.findOne as jest.Mock).mockResolvedValue(user);

      const result = await controller.findOne(id);

      expect(mockUsersService.findOne).toHaveBeenCalledWith(id);
      expect(result).toEqual(user);
    });
  });

  describe('update', () => {
    it('should call usersService.update with id and dto', async () => {
      const id = faker.string.uuid();
      const updateUserDto = { name: faker.person.fullName() };
      const updatedUser = {
        id,
        name: updateUserDto.name,
        email: faker.internet.email(),
      };
      (mockUsersService.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await controller.update(id, updateUserDto);

      expect(mockUsersService.update).toHaveBeenCalledWith(id, updateUserDto);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('removeUser', () => {
    it('should call usersService.remove with id', async () => {
      const id = faker.string.uuid();
      const user = { id, email: faker.internet.email() };
      (mockUsersService.remove as jest.Mock).mockResolvedValue(user);

      const result = await controller.removeUser(id);

      expect(mockUsersService.remove).toHaveBeenCalledWith(id);
      expect(result).toEqual(user);
    });
  });
});