import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';
import {
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

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
      (mockUsersService.findAll as jest.Mock).mockResolvedValue([]);
      (mockUsersService.create as jest.Mock).mockImplementation((dto) =>
        Promise.resolve({ id: '1', ...dto }),
      );

      const result = await service.register(
        'John Doe',
        'john@example.com',
        'Password1!',
      );

      expect(mockUsersService.findAll).toHaveBeenCalledWith('john@example.com');
      expect(mockUsersService.create).toHaveBeenCalled();

      const createArg = (mockUsersService.create as jest.Mock).mock.calls[0][0];
      expect(createArg.name).toBe('John Doe');
      expect(createArg.email).toBe('john@example.com');
      expect(createArg.password).toMatch(/^[a-f0-9]+\.[a-f0-9]+$/);

      expect(result).toEqual(
        expect.objectContaining({
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
        }),
      );
    });

    it('should throw ConflictException if email is already in use', async () => {
      (mockUsersService.findAll as jest.Mock).mockResolvedValue([{ id: '1' }]);

      await expect(
        service.register('John Doe', 'john@example.com', 'Password1!'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return user when credentials are valid', async () => {
      // Register first to obtain a valid hashed password
      (mockUsersService.findAll as jest.Mock).mockResolvedValue([]);
      (mockUsersService.create as jest.Mock).mockImplementation((dto) =>
        Promise.resolve({ id: '1', ...dto }),
      );

      const password = 'Password1!';
      await service.register('John Doe', 'john@example.com', password);
      const hashedPassword = (mockUsersService.create as jest.Mock).mock
        .calls[0][0].password;

      const user = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
      };
      (mockUsersService.findAll as jest.Mock).mockResolvedValue([user]);

      const result = await service.login('john@example.com', password);
      expect(result).toEqual(user);
    });

    it('should throw BadRequestException if user not found', async () => {
      (mockUsersService.findAll as jest.Mock).mockResolvedValue([]);

      await expect(
        service.login('nonexistent@example.com', 'Password1!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      (mockUsersService.findAll as jest.Mock).mockResolvedValue([]);
      (mockUsersService.create as jest.Mock).mockImplementation((dto) =>
        Promise.resolve({ id: '1', ...dto }),
      );

      await service.register('John Doe', 'john@example.com', 'Password1!');
      const hashedPassword = (mockUsersService.create as jest.Mock).mock
        .calls[0][0].password;

      const user = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
      };
      (mockUsersService.findAll as jest.Mock).mockResolvedValue([user]);

      await expect(
        service.login('john@example.com', 'WrongPassword1!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should return logout successful message', async () => {
      const result = await service.logout('some-id');
      expect(result).toBe('Logout successful');
    });
  });
});