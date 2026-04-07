import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ContractStatus, DepositStatus } from '@generated/prisma/client';
import { DepositAction } from './dto/terminate-contract.dto';

const mockTx = {
  contract: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  rent: { create: jest.fn() },
  deposit: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
};

const mockPrisma = {
  local: { findUnique: jest.fn() },
  tenant: { findUnique: jest.fn() },
  contract: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn((cb) => cb(mockTx)),
};

describe('ContractsService', () => {
  let service: ContractsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((cb) => cb(mockTx));
  });

  const createDto = {
    localId: 1,
    tenantId: 1,
    startDate: '2026-01-01',
    rentAmount: 500000,
    depositAmount: 200000,
  };

  describe('create', () => {
    it('should create a contract with rent and deposit', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.contract.findFirst.mockResolvedValue(null);
      const contract = { id: 1, localId: 1, tenantId: 1, status: ContractStatus.ACTIVE };
      mockTx.contract.create.mockResolvedValue(contract);

      const result = await service.create(createDto, 1);

      expect(result).toEqual(contract);
      expect(mockTx.rent.create).toHaveBeenCalledWith({
        data: { contractId: 1, amount: 500000, effectiveFrom: new Date('2026-01-01') },
      });
      expect(mockTx.deposit.create).toHaveBeenCalledWith({
        data: { contractId: 1, amount: 200000 },
      });
    });

    it('should create a contract without deposit when not provided', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.contract.findFirst.mockResolvedValue(null);
      mockTx.contract.create.mockResolvedValue({ id: 1 });

      await service.create({ ...createDto, depositAmount: undefined }, 1);

      expect(mockTx.deposit.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when local does not exist', async () => {
      mockPrisma.local.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when local already has an active contract', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.contract.findFirst.mockResolvedValue({ id: 99 });

      await expect(service.create(createDto, 1)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return contracts with activeRent mapped', async () => {
      const rent = { id: 1, amount: 500000, effectiveTo: null };
      mockPrisma.contract.findMany.mockResolvedValue([
        { id: 1, local: {}, tenant: {}, rents: [rent] },
      ]);

      const result = await service.findAll();

      expect(result[0].activeRent).toEqual(rent);
      expect(result[0]).not.toHaveProperty('rents');
    });

    it('should return null activeRent when no active rent exists', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([
        { id: 1, local: {}, tenant: {}, rents: [] },
      ]);

      const result = await service.findAll();

      expect(result[0].activeRent).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should return a contract with activeRent', async () => {
      const rent = { id: 1, amount: 500000, effectiveTo: null };
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1, local: {}, tenant: {}, rents: [rent], deposit: null,
      });

      const result = await service.findOne(1);

      expect(result.activeRent).toEqual(rent);
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('terminate', () => {
    const terminateDto = { endDate: '2026-12-31', depositAction: DepositAction.REFUNDED };
    const contract = { id: 1, status: ContractStatus.ACTIVE, deposit: { id: 1 } };

    it('should terminate a contract and refund deposit', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(contract);
      const terminated = { id: 1, status: ContractStatus.TERMINATED };
      mockTx.contract.findUnique.mockResolvedValue(terminated);

      const result = await service.terminate(1, terminateDto);

      expect(mockTx.contract.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: ContractStatus.TERMINATED, endDate: new Date('2026-12-31') },
      });
      expect(mockTx.deposit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DepositStatus.REFUNDED }),
        }),
      );
      expect(result).toEqual(terminated);
    });

    it('should terminate and mark deposit as USED with usageNote', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(contract);
      mockTx.contract.findUnique.mockResolvedValue({ id: 1 });

      await service.terminate(1, {
        endDate: '2026-12-31',
        depositAction: DepositAction.USED,
        usageNote: 'Dernier mois',
      });

      expect(mockTx.deposit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DepositStatus.USED, usageNote: 'Dernier mois' }),
        }),
      );
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.terminate(999, terminateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when contract is not active', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 1, status: ContractStatus.TERMINATED });

      await expect(service.terminate(1, terminateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    it('should cancel a contract and delete deposit', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1, status: ContractStatus.ACTIVE, payments: [],
      });
      mockTx.deposit.findUnique.mockResolvedValue({ id: 1 });
      mockTx.contract.update.mockResolvedValue({ id: 1, status: ContractStatus.CANCELED });

      const result = await service.cancel(1);

      expect(mockTx.deposit.delete).toHaveBeenCalledWith({ where: { contractId: 1 } });
      expect(result.status).toBe(ContractStatus.CANCELED);
    });

    it('should cancel without deleting deposit if none exists', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1, status: ContractStatus.ACTIVE, payments: [],
      });
      mockTx.deposit.findUnique.mockResolvedValue(null);
      mockTx.contract.update.mockResolvedValue({ id: 1, status: ContractStatus.CANCELED });

      await service.cancel(1);

      expect(mockTx.deposit.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.cancel(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when contract is not active', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 1, status: ContractStatus.CANCELED, payments: [] });

      await expect(service.cancel(1)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when payments exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1, status: ContractStatus.ACTIVE, payments: [{ id: 1 }],
      });

      await expect(service.cancel(1)).rejects.toThrow(ConflictException);
    });
  });
});
