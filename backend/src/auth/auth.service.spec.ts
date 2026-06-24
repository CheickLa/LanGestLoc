import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma, Role } from '@generated/prisma/client';

jest.mock('bcrypt');

const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const dto = { name: 'John', email: 'john@test.com', password: 'Password123' };

    it('should hash password, create user with Role.USER by default, and return token', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({
        id: 1, email: dto.email, role: Role.USER,
      });

      const result = await service.register(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          email: dto.email,
          password: 'hashed-password',
          role: Role.USER,
        },
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 1, email: dto.email, role: Role.USER,
      });
      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
    });

    it('should use provided role when specified', async () => {
      const adminDto = { ...dto, role: Role.ADMIN };
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({
        id: 1, email: dto.email, role: Role.ADMIN,
      });

      await service.register(adminDto);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: Role.ADMIN }),
      });
    });

    it('should throw ConflictException on duplicate email', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      mockPrisma.user.create.mockRejectedValue(prismaError);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should rethrow unexpected errors', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockRejectedValue(new Error('DB down'));

      await expect(service.register(dto)).rejects.toThrow('DB down');
    });
  });

  describe('validateUser', () => {
    const email = 'john@test.com';
    const password = 'Password123';

    it('should return user data on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, email, name: 'John', role: Role.USER, password: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(email, password);

      expect(result).toEqual({ id: 1, email, name: 'John', role: Role.USER });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.validateUser(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, email, name: 'John', role: Role.USER, password: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('login', () => {
    it('should return an access token', async () => {
      const user = { id: 1, email: 'john@test.com', role: Role.USER };

      const result = await service.login(user);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 1, email: user.email, role: Role.USER,
      });
      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
    });
  });

  describe('getProfile', () => {
    it('should return user profile without password', async () => {
      const profile = {
        id: 1, name: 'John', email: 'john@test.com',
        role: Role.USER, createdAt: new Date(),
      };
      mockPrisma.user.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile(1);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
      expect(result).toEqual(profile);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile(999)).rejects.toThrow(UnauthorizedException);
    });
  });
});
