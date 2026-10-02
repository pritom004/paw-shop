import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

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
        name: 'John',
        email: 'john@example.com',
        password: 'Password1!',
      };
      const user = { id: '1', ...body };
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
      const body = { email: 'john@example.com', password: 'Password1!' };
      const user = { id: '1', email: body.email };
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
      const session = { userId: '1' };
      controller.logout(session);
      expect(session.userId).toBeNull();
    });
  });

  describe('whoami', () => {
    it('should return the current user', () => {
      const user = { id: '1', email: 'john@example.com' };
      const result = controller.whoami(user);
      expect(result).toEqual(user);
    });

    it('should throw UnauthorizedException if no user', () => {
      expect(() => controller.whoami(null)).toThrow(UnauthorizedException);
    });
  });

  describe('findOne', () => {
    it('should call usersService.findOne with id', async () => {
      const user = { id: '1', email: 'john@example.com' };
      (mockUsersService.findOne as jest.Mock).mockResolvedValue(user);

      const result = await controller.findOne('1');

      expect(mockUsersService.findOne).toHaveBeenCalledWith('1');
      expect(result).toEqual(user);
    });
  });

  describe('update', () => {
    it('should call usersService.update with id and dto', async () => {
      const updateUserDto = { name: 'Jane' };
      const updatedUser = {
        id: '1',
        name: 'Jane',
        email: 'john@example.com',
      };
      (mockUsersService.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await controller.update('1', updateUserDto);

      expect(mockUsersService.update).toHaveBeenCalledWith('1', updateUserDto);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('removeUser', () => {
    it('should call usersService.remove with id', async () => {
      const user = { id: '1', email: 'john@example.com' };
      (mockUsersService.remove as jest.Mock).mockResolvedValue(user);

      const result = await controller.removeUser('1');

      expect(mockUsersService.remove).toHaveBeenCalledWith('1');
      expect(result).toEqual(user);
    });
  });
});