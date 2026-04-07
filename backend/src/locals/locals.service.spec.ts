import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LocalsService } from './locals.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  local: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('LocalsService', () => {
  let service: LocalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LocalsService>(LocalsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = { code: 'LOCAL-001', name: 'Boutique 1' };

    it('should create a local when code is unique', async () => {
      mockPrisma.local.findUnique.mockResolvedValue(null);
      mockPrisma.local.create.mockResolvedValue({ id: 1, ...dto });

      const result = await service.create(dto);

      expect(mockPrisma.local.findUnique).toHaveBeenCalledWith({ where: { code: 'LOCAL-001' } });
      expect(result).toEqual({ id: 1, ...dto });
    });

    it('should throw ConflictException when code already exists', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 2, ...dto });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all locals', async () => {
      const locals = [{ id: 1, code: 'LOCAL-001', name: 'B1' }];
      mockPrisma.local.findMany.mockResolvedValue(locals);

      const result = await service.findAll();

      expect(result).toEqual(locals);
    });
  });

  describe('findOne', () => {
    it('should return a local by id', async () => {
      const local = { id: 1, code: 'LOCAL-001', name: 'B1' };
      mockPrisma.local.findUnique.mockResolvedValue(local);

      const result = await service.findOne(1);

      expect(result).toEqual(local);
    });

    it('should throw NotFoundException when local does not exist', async () => {
      mockPrisma.local.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const existing = { id: 1, code: 'LOCAL-001', name: 'B1' };

    it('should update a local', async () => {
      mockPrisma.local.findUnique.mockResolvedValue(existing);
      mockPrisma.local.update.mockResolvedValue({ ...existing, name: 'B1 updated' });

      const result = await service.update(1, { name: 'B1 updated' });

      expect(result.name).toBe('B1 updated');
    });

    it('should throw NotFoundException when local does not exist', async () => {
      mockPrisma.local.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updating to an existing code', async () => {
      mockPrisma.local.findUnique
        .mockResolvedValueOnce(existing) // findUnique for the local being updated
        .mockResolvedValueOnce({ id: 2, code: 'LOCAL-002', name: 'B2' }); // findUnique for duplicate check

      await expect(service.update(1, { code: 'LOCAL-002' })).rejects.toThrow(ConflictException);
    });

    it('should allow updating to the same code', async () => {
      mockPrisma.local.findUnique.mockResolvedValue(existing);
      mockPrisma.local.update.mockResolvedValue(existing);

      const result = await service.update(1, { code: 'LOCAL-001' });

      expect(result).toEqual(existing);
      // findUnique called only once (no duplicate check when code unchanged)
      expect(mockPrisma.local.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('should delete a local with no contracts', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1, contracts: [] });
      mockPrisma.local.delete.mockResolvedValue({ id: 1 });

      const result = await service.remove(1);

      expect(mockPrisma.local.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ id: 1 });
    });

    it('should throw NotFoundException when local does not exist', async () => {
      mockPrisma.local.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when local has contracts', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1, contracts: [{ id: 1 }] });

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
    });
  });
});
