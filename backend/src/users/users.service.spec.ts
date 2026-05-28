import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Role } from '@generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from '@/prisma/prisma.service';

jest.mock('bcrypt');

const mockPrisma: any = {
  user: {
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  contract: {
    count: jest.fn(),
  },
  payment: {
    count: jest.fn(),
  },
  $transaction: jest.fn((arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(mockPrisma))),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  const userSafe = {
    id: 1,
    name: 'John',
    email: 'john@test.com',
    role: Role.USER,
    createdAt: new Date(),
  };

  describe('updateMe', () => {
    it('should update name and email and return safe user (no password)', async () => {
      const updated = { ...userSafe, name: 'Updated', email: 'new@test.com' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateMe(1, { name: 'Updated', email: 'new@test.com' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Updated', email: 'new@test.com' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(updated);
    });

    it('should update only name when email is absent', async () => {
      const updated = { ...userSafe, name: 'Updated' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateMe(1, { name: 'Updated' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Updated' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(updated);
    });

    it('should throw BadRequestException when no data is provided', async () => {
      await expect(service.updateMe(1, {})).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on duplicate email (P2002)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      mockPrisma.user.update.mockRejectedValue(prismaError);

      await expect(
        service.updateMe(1, { email: 'dup@test.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when record is missing (P2025)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockPrisma.user.update.mockRejectedValue(prismaError);

      await expect(service.updateMe(999, { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('should rethrow unexpected errors', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('DB down'));

      await expect(service.updateMe(1, { name: 'X' })).rejects.toThrow('DB down');
    });
  });

  describe('changePassword', () => {
    const userRecord = { id: 1, password: 'hashed-current' };

    it('should hash new password and update user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userRecord);
      mockPrisma.user.update.mockResolvedValue({ ...userSafe });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new');

      const result = await service.changePassword(1, {
        currentPassword: 'oldPass123',
        newPassword: 'newPass123',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith('oldPass123', 'hashed-current');
      expect(bcrypt.hash).toHaveBeenCalledWith('newPass123', 10);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { password: 'hashed-new' },
      });
      expect(result).toEqual({ message: 'Mot de passe mis à jour' });
    });

    it('should throw BadRequestException when new password equals current', async () => {
      await expect(
        service.changePassword(1, {
          currentPassword: 'samePass123',
          newPassword: 'samePass123',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword(999, {
          currentPassword: 'oldPass123',
          newPassword: 'newPass123',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException when current password is invalid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userRecord);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(1, {
          currentPassword: 'wrongPass',
          newPassword: 'newPass123',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated users with safe select ordered by createdAt desc', async () => {
      const users = [userSafe, { ...userSafe, id: 2, role: Role.ADMIN }];
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(2);

      const result = await service.findAll({ skip: 0, take: 20 });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual({ items: users, total: 2, skip: 0, take: 20 });
    });
  });

  describe('findOne', () => {
    it('should return user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userSafe);

      const result = await service.findOne(1);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(userSafe);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('adminUpdate', () => {
    it('should throw BadRequestException when no data is provided', async () => {
      await expect(service.adminUpdate(2, {})).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.adminUpdate(999, { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('should update name, email and role when user exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, role: Role.USER });
      const updated = { ...userSafe, id: 2, name: 'New', email: 'new@test.com', role: Role.ADMIN };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.adminUpdate(2, {
        name: 'New',
        email: 'new@test.com',
        role: Role.ADMIN,
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { name: 'New', email: 'new@test.com', role: Role.ADMIN },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(updated);
    });

    it('should throw BadRequestException when demoting the last ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: Role.ADMIN });
      mockPrisma.user.count.mockResolvedValue(0);

      await expect(
        service.adminUpdate(1, { role: Role.USER }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { role: Role.ADMIN, id: { not: 1 } },
      });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should allow demoting an ADMIN when another ADMIN exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: Role.ADMIN });
      mockPrisma.user.count.mockResolvedValue(1);
      const updated = { ...userSafe, role: Role.USER };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.adminUpdate(1, { role: Role.USER });

      expect(result).toEqual(updated);
    });

    it('should throw ConflictException on duplicate email (P2002)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, role: Role.USER });
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      mockPrisma.user.update.mockRejectedValue(prismaError);

      await expect(
        service.adminUpdate(2, { email: 'dup@test.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should throw BadRequestException when deleting self', async () => {
      await expect(service.remove(1, 1)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.remove(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when deleting the last ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, role: Role.ADMIN });
      mockPrisma.user.count.mockResolvedValue(0);

      await expect(service.remove(2, 1)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when user has linked contracts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, role: Role.USER });
      mockPrisma.contract.count.mockResolvedValue(3);
      mockPrisma.payment.count.mockResolvedValue(0);

      await expect(service.remove(2, 1)).rejects.toThrow(ConflictException);
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when user has linked payments', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, role: Role.USER });
      mockPrisma.contract.count.mockResolvedValue(0);
      mockPrisma.payment.count.mockResolvedValue(5);

      await expect(service.remove(2, 1)).rejects.toThrow(ConflictException);
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('should delete the user when all checks pass', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, role: Role.USER });
      mockPrisma.contract.count.mockResolvedValue(0);
      mockPrisma.payment.count.mockResolvedValue(0);
      mockPrisma.user.delete.mockResolvedValue(userSafe);

      await service.remove(2, 1);

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    });

    it('should check last-admin guard when deleting an ADMIN and allow if another exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, role: Role.ADMIN });
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.contract.count.mockResolvedValue(0);
      mockPrisma.payment.count.mockResolvedValue(0);
      mockPrisma.user.delete.mockResolvedValue({ ...userSafe, role: Role.ADMIN });

      await service.remove(2, 1);

      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { role: Role.ADMIN, id: { not: 2 } },
      });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    });
  });
});
