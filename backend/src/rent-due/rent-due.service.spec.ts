import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RentDueService } from './rent-due.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ContractStatus, RentDueStatus } from '@generated/prisma/client';

const mockPrisma = {
  contract: { findUnique: jest.fn(), findMany: jest.fn() },
  rent: { findFirst: jest.fn() },
  rentDue: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
};

describe('RentDueService', () => {
  let service: RentDueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentDueService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RentDueService>(RentDueService);
    jest.clearAllMocks();
  });

  const dto = { contractId: 1, month: '2026-04' };
  const activeContract = {
    id: 1,
    status: ContractStatus.ACTIVE,
    startDate: new Date('2026-01-01'),
    endDate: null,
  };
  const activeRent = {
    id: 1,
    contractId: 1,
    amount: 500000,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
  };

  describe('generate', () => {
    it('should create a rent due for the given contract and month', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);
      mockPrisma.rentDue.findUnique.mockResolvedValue(null);
      mockPrisma.rent.findFirst.mockResolvedValue(activeRent);
      const created = {
        id: 1,
        contractId: 1,
        rentId: 1,
        month: new Date(Date.UTC(2026, 3, 1)),
        amount: 500000,
        dueDate: new Date(Date.UTC(2026, 4, 5)),
      };
      mockPrisma.rentDue.create.mockResolvedValue(created);

      const result = await service.generate(dto);

      expect(result).toEqual(created);
      expect(mockPrisma.rentDue.create).toHaveBeenCalledWith({
        data: {
          contractId: 1,
          rentId: 1,
          month: new Date(Date.UTC(2026, 3, 1)),
          amount: 500000,
          dueDate: new Date(Date.UTC(2026, 4, 5)),
        },
      });
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.generate(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when contract is not active', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.TERMINATED,
      });

      await expect(service.generate(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when rent due already exists for month', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);
      mockPrisma.rentDue.findUnique.mockResolvedValue({ id: 1 });

      await expect(service.generate(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when no active rent found', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);
      mockPrisma.rentDue.findUnique.mockResolvedValue(null);
      mockPrisma.rent.findFirst.mockResolvedValue(null);

      await expect(service.generate(dto)).rejects.toThrow(NotFoundException);
    });

    it('refuse un mois avant le début du contrat', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        ...activeContract,
        startDate: new Date('2026-05-01'),
      });

      await expect(service.generate(dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.rentDue.create).not.toHaveBeenCalled();
    });

    it('refuse un mois après la fin du contrat', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        ...activeContract,
        endDate: new Date('2026-03-31'),
      });

      await expect(service.generate(dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.rentDue.create).not.toHaveBeenCalled();
    });

    it('accepte le mois de début et le mois de fin du contrat', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        ...activeContract,
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-30'),
      });
      mockPrisma.rentDue.findUnique.mockResolvedValue(null);
      mockPrisma.rent.findFirst.mockResolvedValue(activeRent);
      mockPrisma.rentDue.create.mockResolvedValue({ id: 2 });

      await service.generate(dto);

      expect(mockPrisma.rentDue.create).toHaveBeenCalled();
    });

    it("accepte janvier pour un contrat commencé en décembre de l'année précédente", async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        ...activeContract,
        startDate: new Date('2025-12-01'),
      });
      mockPrisma.rentDue.findUnique.mockResolvedValue(null);
      mockPrisma.rent.findFirst.mockResolvedValue(activeRent);
      mockPrisma.rentDue.create.mockResolvedValue({ id: 3 });

      await service.generate({ ...dto, month: '2026-01' });

      expect(mockPrisma.rentDue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          month: new Date('2026-01-01'),
          dueDate: new Date('2026-02-05'),
        }),
      });
    });

    it("refuse janvier pour un contrat terminé en décembre de l'année précédente", async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        ...activeContract,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });

      await expect(
        service.generate({ ...dto, month: '2026-01' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.rentDue.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllByContract', () => {
    it('should return all rent dues for a contract', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);
      const dues = [{ id: 1, amount: 500000 }];
      mockPrisma.rentDue.findMany.mockResolvedValue(dues);

      const result = await service.findAllByContract(1);

      expect(result).toEqual(dues);
      expect(mockPrisma.rentDue.findMany).toHaveBeenCalledWith({
        where: { contractId: 1 },
        orderBy: { month: 'desc' },
      });
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.findAllByContract(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByContract', () => {
    it('should return rent dues filtered by status', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);
      const dues = [{ id: 1, status: RentDueStatus.PENDING }];
      mockPrisma.rentDue.findMany.mockResolvedValue(dues);

      const result = await service.findByContract(1, RentDueStatus.PENDING);

      expect(result).toEqual(dues);
      expect(mockPrisma.rentDue.findMany).toHaveBeenCalledWith({
        where: { contractId: 1, status: RentDueStatus.PENDING },
        orderBy: { month: 'desc' },
      });
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.findByContract(999, RentDueStatus.PENDING),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateForAllActiveContracts', () => {
    beforeAll(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-15T10:00:00Z'));
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('ne génère que pour les contrats actifs dont la période couvre le mois', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);
      mockPrisma.rentDue.findUnique.mockResolvedValue(null);
      mockPrisma.rent.findFirst.mockResolvedValue(activeRent);
      mockPrisma.rentDue.create.mockResolvedValue({ id: 1 });

      await service.generateForAllActiveContracts();

      expect(mockPrisma.contract.findMany).toHaveBeenCalledWith({
        where: {
          status: ContractStatus.ACTIVE,
          startDate: { lt: new Date('2026-11-01') },
          OR: [{ endDate: null }, { endDate: { gte: new Date('2026-10-01') } }],
        },
        select: { id: true },
      });
      expect(mockPrisma.rentDue.create).toHaveBeenCalledTimes(2);
    });

    it('should skip contracts that already have a rent due (ConflictException)', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([{ id: 1 }]);
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);
      mockPrisma.rentDue.findUnique.mockResolvedValue({ id: 1 }); // already exists

      await service.generateForAllActiveContracts();

      expect(mockPrisma.rentDue.create).not.toHaveBeenCalled();
    });

    describe('en janvier', () => {
      beforeAll(() => {
        jest.setSystemTime(new Date('2027-01-01T00:00:00Z'));
      });

      afterAll(() => {
        jest.setSystemTime(new Date('2026-10-15T10:00:00Z'));
      });

      it('crée le mois de janvier de la nouvelle année', async () => {
        mockPrisma.contract.findMany.mockResolvedValue([{ id: 1 }]);
        mockPrisma.contract.findUnique.mockResolvedValue(activeContract);
        mockPrisma.rentDue.findUnique.mockResolvedValue(null);
        mockPrisma.rent.findFirst.mockResolvedValue(activeRent);
        mockPrisma.rentDue.create.mockResolvedValue({ id: 1 });

        await service.generateForAllActiveContracts();

        expect(mockPrisma.contract.findMany).toHaveBeenCalledWith({
          where: {
            status: ContractStatus.ACTIVE,
            startDate: { lt: new Date('2027-02-01') },
            OR: [
              { endDate: null },
              { endDate: { gte: new Date('2027-01-01') } },
            ],
          },
          select: { id: true },
        });
        expect(mockPrisma.rentDue.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            month: new Date('2027-01-01'),
            dueDate: new Date('2027-02-05'),
          }),
        });
      });
    });
  });

  describe('markOverdueAsLate', () => {
    it('should mark overdue PENDING rent dues as LATE', async () => {
      mockPrisma.rentDue.updateMany.mockResolvedValue({ count: 3 });

      await service.markOverdueAsLate();

      expect(mockPrisma.rentDue.updateMany).toHaveBeenCalledWith({
        where: {
          status: RentDueStatus.PENDING,
          dueDate: { lt: expect.any(Date) },
        },
        data: { status: RentDueStatus.LATE },
      });
    });

    it('should do nothing when no overdue rent dues exist', async () => {
      mockPrisma.rentDue.updateMany.mockResolvedValue({ count: 0 });

      await service.markOverdueAsLate();

      expect(mockPrisma.rentDue.updateMany).toHaveBeenCalled();
    });
  });
});
