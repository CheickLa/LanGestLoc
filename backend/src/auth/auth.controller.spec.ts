import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role } from '@generated/prisma/client';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  getProfile: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should call authService.register and return token', async () => {
      const dto = {
        name: 'John',
        email: 'john@test.com',
        password: 'Password123',
      };
      mockAuthService.register.mockResolvedValue({ accessToken: 'token' });

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ accessToken: 'token' });
    });
  });

  describe('POST /auth/login', () => {
    it('should call authService.login with req.user', () => {
      const user = { id: 1, tokenVersion: 0 };
      const req = { user };
      mockAuthService.login.mockReturnValue({ accessToken: 'token' });

      const result = controller.login(req, {
        email: 'john@test.com',
        password: 'Password123',
      });

      expect(mockAuthService.login).toHaveBeenCalledWith(user);
      expect(result).toEqual({ accessToken: 'token' });
    });
  });

  describe('GET /auth/me', () => {
    it('should call authService.getProfile with user id', async () => {
      const user = { id: 1, email: 'john@test.com', role: Role.USER };
      const profile = {
        id: 1,
        name: 'John',
        email: 'john@test.com',
        role: Role.USER,
        createdAt: new Date(),
      };
      mockAuthService.getProfile.mockResolvedValue(profile);

      const result = await controller.getProfile(user);

      expect(mockAuthService.getProfile).toHaveBeenCalledWith(1);
      expect(result).toEqual(profile);
    });
  });
});
