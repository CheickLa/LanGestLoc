import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('TenantsService', () => {
  let service: TenantsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    jest.clearAllMocks();
  });

  const tenantDto = {
    name: 'Jean Dupont',
    phone: '0601020304',
    dateOfBirth: '1990-01-15',
    idNumber: 'ID12345',
    activity: 'Commerce',
  };

  const tenantEntity = {
    id: 1,
    ...tenantDto,
    dateOfBirth: new Date('1990-01-15'),
    createdAt: new Date(),
  };

  describe('create', () => {
    it('should create a tenant when data is valid', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue(tenantEntity);

      const result = await service.create(tenantDto);

      expect(result).toEqual(tenantEntity);
    });

    it('should throw BadRequestException when dateOfBirth is in the future', async () => {
      const futureDto = { ...tenantDto, dateOfBirth: '2099-01-01' };

      await expect(service.create(futureDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when idNumber already exists', async () => {
      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce(tenantEntity) // idNumber exists
        .mockResolvedValueOnce(null); // phone free

      await expect(service.create(tenantDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when phone already exists', async () => {
      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce(null) // idNumber free
        .mockResolvedValueOnce(tenantEntity); // phone exists

      await expect(service.create(tenantDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all tenants', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([tenantEntity]);

      const result = await service.findAll();

      expect(result).toEqual([tenantEntity]);
    });
  });

  describe('findOne', () => {
    it('should return a tenant by id', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(tenantEntity);

      const result = await service.findOne(1);

      expect(result).toEqual(tenantEntity);
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(tenantEntity);
      mockPrisma.tenant.update.mockResolvedValue({ ...tenantEntity, name: 'Updated' });

      const result = await service.update(1, { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when updating dateOfBirth to future', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(tenantEntity);

      await expect(service.update(1, { dateOfBirth: '2099-01-01' })).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when updating to existing idNumber', async () => {
      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce(tenantEntity) // findOne check
        .mockResolvedValueOnce({ ...tenantEntity, id: 2 }); // idNumber conflict

      await expect(service.update(1, { idNumber: 'EXISTING' })).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when updating to existing phone', async () => {
      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce(tenantEntity) // findOne check
        .mockResolvedValueOnce({ ...tenantEntity, id: 2 }); // phone conflict

      await expect(service.update(1, { phone: '9999999' })).rejects.toThrow(ConflictException);
    });

    it('should allow updating idNumber to the same value', async () => {
      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce(tenantEntity) // findOne check
        .mockResolvedValueOnce(tenantEntity); // same tenant found by idNumber
      mockPrisma.tenant.update.mockResolvedValue(tenantEntity);

      const result = await service.update(1, { idNumber: 'ID12345' });

      expect(result).toEqual(tenantEntity);
    });
  });

  describe('remove', () => {
    it('should delete a tenant with no contracts', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ ...tenantEntity, contracts: [] });
      mockPrisma.tenant.delete.mockResolvedValue(tenantEntity);

      const result = await service.remove(1);

      expect(mockPrisma.tenant.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(tenantEntity);
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when tenant has contracts', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ ...tenantEntity, contracts: [{ id: 1 }] });

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
    });
  });
});
