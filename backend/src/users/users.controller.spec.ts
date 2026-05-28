import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@generated/prisma/client';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const mockUsersService = {
  updateMe: jest.fn(),
  changePassword: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  adminUpdate: jest.fn(),
  remove: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  describe('PATCH /users/me', () => {
    it('should call service.updateMe with current user id and dto', async () => {
      const updated = { id: 1, name: 'Updated', email: 'u@test.com', role: Role.USER };
      mockUsersService.updateMe.mockResolvedValue(updated);

      const result = await controller.updateMe(
        { id: 1, email: 'old@test.com', role: Role.USER },
        { name: 'Updated', email: 'u@test.com' },
      );

      expect(mockUsersService.updateMe).toHaveBeenCalledWith(1, {
        name: 'Updated',
        email: 'u@test.com',
      });
      expect(result).toEqual(updated);
    });
  });

  describe('PATCH /users/me/password', () => {
    it('should call service.changePassword with current user id and dto', async () => {
      const response = { message: 'Mot de passe mis à jour' };
      mockUsersService.changePassword.mockResolvedValue(response);

      const result = await controller.changePassword(
        { id: 1, email: 'u@test.com', role: Role.USER },
        { currentPassword: 'oldPass123', newPassword: 'newPass123' },
      );

      expect(mockUsersService.changePassword).toHaveBeenCalledWith(1, {
        currentPassword: 'oldPass123',
        newPassword: 'newPass123',
      });
      expect(result).toEqual(response);
    });
  });

  describe('GET /users', () => {
    it('should call service.findAll with pagination', async () => {
      const paginated = {
        items: [
          { id: 1, name: 'Admin', email: 'a@test.com', role: Role.ADMIN },
          { id: 2, name: 'User', email: 'u@test.com', role: Role.USER },
        ],
        total: 2,
        skip: 0,
        take: 20,
      };
      mockUsersService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ skip: 0, take: 20 });

      expect(mockUsersService.findAll).toHaveBeenCalledWith({ skip: 0, take: 20 });
      expect(result).toEqual(paginated);
    });
  });

  describe('GET /users/:id', () => {
    it('should call service.findOne with id', async () => {
      const user = { id: 2, name: 'User', email: 'u@test.com', role: Role.USER };
      mockUsersService.findOne.mockResolvedValue(user);

      const result = await controller.findOne(2);

      expect(mockUsersService.findOne).toHaveBeenCalledWith(2);
      expect(result).toEqual(user);
    });
  });

  describe('PATCH /users/:id', () => {
    it('should call service.adminUpdate with id and dto', async () => {
      const updated = { id: 2, name: 'Updated', email: 'u@test.com', role: Role.ADMIN };
      mockUsersService.adminUpdate.mockResolvedValue(updated);

      const result = await controller.adminUpdate(2, {
        name: 'Updated',
        role: Role.ADMIN,
      });

      expect(mockUsersService.adminUpdate).toHaveBeenCalledWith(2, {
        name: 'Updated',
        role: Role.ADMIN,
      });
      expect(result).toEqual(updated);
    });
  });

  describe('DELETE /users/:id', () => {
    it('should call service.remove with target id and current user id', async () => {
      mockUsersService.remove.mockResolvedValue(undefined);

      await controller.remove({ id: 1, email: 'a@test.com', role: Role.ADMIN }, 2);

      expect(mockUsersService.remove).toHaveBeenCalledWith(2, 1);
    });
  });
});
