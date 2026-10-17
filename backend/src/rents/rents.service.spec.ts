import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RentsService } from './rents.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ContractStatus } from '@generated/prisma/client';

const mockTx = {
  rent: { update: jest.fn(), create: jest.fn() },
};

type MockTx = typeof mockTx;

const runInTransaction = <T>(cb: (tx: MockTx) => Promise<T>) => cb(mockTx);

const mockPrisma = {
  contract: { findUnique: jest.fn() },
  rent: { findFirst: jest.fn(), findMany: jest.fn() },
  rentDue: { findFirst: jest.fn() },
  $transaction: jest.fn(runInTransaction),
};

describe('RentsService', () => {
  let service: RentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RentsService>(RentsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(runInTransaction);
  });

  const activeRent = {
    id: 1,
    contractId: 1,
    amount: 500000,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
  };

  describe('create', () => {
    const dto = { contractId: 1, amount: 600000, effectiveFrom: '2026-04-01' };

    it('should close old rent and create new rent', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
      });
      mockPrisma.rent.findFirst.mockResolvedValue(activeRent);
      const newRent = {
        id: 2,
        contractId: 1,
        amount: 600000,
        effectiveFrom: new Date('2026-04-01'),
      };
      mockTx.rent.create.mockResolvedValue(newRent);

      const result = await service.create(dto);

      expect(mockTx.rent.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { effectiveTo: new Date('2026-03-31') },
      });
      expect(mockTx.rent.create).toHaveBeenCalledWith({
        data: {
          contractId: 1,
          amount: 600000,
          effectiveFrom: new Date('2026-04-01'),
        },
      });
      expect(result).toEqual(newRent);
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when contract is not active', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.TERMINATED,
      });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when no active rent found', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
      });
      mockPrisma.rent.findFirst.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when amount is the same', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
      });
      mockPrisma.rent.findFirst.mockResolvedValue(activeRent);

      await expect(service.create({ ...dto, amount: 500000 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when amount is lower than the current rent', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
      });
      mockPrisma.rent.findFirst.mockResolvedValue(activeRent);

      await expect(service.create({ ...dto, amount: 400000 })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.rent.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when effectiveFrom is before current', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
      });
      mockPrisma.rent.findFirst.mockResolvedValue(activeRent);

      await expect(
        service.create({ ...dto, effectiveFrom: '2025-12-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when effectiveFrom is not the 1st of a month', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
      });
      mockPrisma.rent.findFirst.mockResolvedValue(activeRent);

      await expect(
        service.create({ ...dto, effectiveFrom: '2026-04-15' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.rent.create).not.toHaveBeenCalled();
    });

    it('refuse une augmentation sur un mois déjà facturé', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
        endDate: null,
      });
      mockPrisma.rent.findFirst.mockResolvedValue(activeRent);
      mockPrisma.rentDue.findFirst.mockResolvedValue({
        month: new Date('2026-10-01'),
      });

      await expect(service.create(dto)).rejects.toThrow(
        "Le loyer est déjà facturé jusqu'en 2026-10",
      );
      expect(mockPrisma.rentDue.findFirst).toHaveBeenCalledWith({
        where: { contractId: 1, month: { gte: new Date('2026-04-01') } },
        orderBy: { month: 'desc' },
      });
      expect(mockTx.rent.create).not.toHaveBeenCalled();
    });

    it('refuse une augmentation après la fin prévue du contrat', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
        endDate: new Date('2026-03-31'),
      });
      mockPrisma.rent.findFirst.mockResolvedValue(activeRent);
      mockPrisma.rentDue.findFirst.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(
        "L'augmentation ne peut pas prendre effet après la fin prévue du contrat",
      );
      expect(mockTx.rent.create).not.toHaveBeenCalled();
    });

    it('accepte une augmentation au mois de la fin prévue', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
        endDate: new Date('2026-04-30'),
      });
      mockPrisma.rent.findFirst.mockResolvedValue(activeRent);
      mockPrisma.rentDue.findFirst.mockResolvedValue(null);
      mockTx.rent.create.mockResolvedValue({ id: 2 });

      await service.create(dto);

      expect(mockTx.rent.create).toHaveBeenCalled();
    });
  });

  describe('findCurrent', () => {
    it('should return the active rent', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.rent.findFirst.mockResolvedValue(activeRent);

      const result = await service.findCurrent(1);

      expect(result).toEqual(activeRent);
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.findCurrent(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when no active rent', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.rent.findFirst.mockResolvedValue(null);

      await expect(service.findCurrent(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllByContract', () => {
    it('should return all rents for a contract', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.rent.findMany.mockResolvedValue([activeRent]);

      const result = await service.findAllByContract(1);

      expect(result).toEqual([activeRent]);
      expect(mockPrisma.rent.findMany).toHaveBeenCalledWith({
        where: { contractId: 1 },
        orderBy: { effectiveFrom: 'asc' },
      });
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.findAllByContract(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
