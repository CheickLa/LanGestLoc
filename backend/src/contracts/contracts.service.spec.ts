import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentsService } from '@/payments/payments.service';
import { ContractDocumentsService } from './contract-documents.service';
import {
  ContractStatus,
  PaymentMethod,
  PaymentType,
  Prisma,
  RentDueStatus,
} from '@generated/prisma/client';

const mockTx = {
  contract: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
  },
  rent: { create: jest.fn() },
  rentDue: { deleteMany: jest.fn() },
  deposit: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockPrisma = {
  local: { findUnique: jest.fn() },
  tenant: { findUnique: jest.fn() },
  contract: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  rentDue: { count: jest.fn() },
  $transaction: jest.fn((arg) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(mockTx),
  ),
};

const mockPaymentsService = {
  createDepositHeld: jest.fn(),
  createDepositRefund: jest.fn(),
  generateReceiptSafe: jest.fn(),
};

const mockContractDocumentsService = {
  generateSafe: jest.fn(),
};

describe('ContractsService', () => {
  let service: ContractsService;

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2027-06-15'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaymentsService, useValue: mockPaymentsService },
        {
          provide: ContractDocumentsService,
          useValue: mockContractDocumentsService,
        },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((arg) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(mockTx),
    );
  });

  const createDto = {
    localId: 1,
    tenantId: 1,
    startDate: '2026-01-01',
    rentAmount: 500000,
    depositPaymentMethod: PaymentMethod.CASH,
    depositPaymentDate: '2026-01-01',
  };

  describe('create', () => {
    it('should create a contract with rent, deposit, and DEPOSIT_HELD payment', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 1 });
      mockTx.contract.findFirst.mockResolvedValue(null);
      const contract = {
        id: 1,
        localId: 1,
        tenantId: 1,
        status: ContractStatus.ACTIVE,
      };
      mockTx.contract.create.mockResolvedValue(contract);
      mockPaymentsService.createDepositHeld.mockResolvedValue({ id: 55 });

      const result = await service.create(createDto, 1);

      expect(result).toEqual(contract);
      expect(mockTx.rent.create).toHaveBeenCalledWith({
        data: {
          contractId: 1,
          amount: 500000,
          effectiveFrom: new Date('2026-01-01'),
        },
      });
      expect(mockTx.deposit.create).toHaveBeenCalledWith({
        data: { contractId: 1, amount: 500000 },
      });
      expect(mockPaymentsService.createDepositHeld).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          contractId: 1,
          amount: 500000,
          userId: 1,
          paymentDate: new Date('2026-01-01'),
          paymentMethod: PaymentMethod.CASH,
        }),
      );
      expect(mockPaymentsService.generateReceiptSafe).toHaveBeenCalledWith(55);
      expect(mockContractDocumentsService.generateSafe).toHaveBeenCalledWith(1);
    });

    it('should throw BadRequestException when endDate is not after startDate', async () => {
      await expect(
        service.create({ ...createDto, endDate: '2026-01-01' }, 1),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create({ ...createDto, endDate: '2025-12-31' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when depositPaymentDate is in the future', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 1 });

      await expect(
        service.create({ ...createDto, depositPaymentDate: '2030-01-01' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when local does not exist', async () => {
      mockPrisma.local.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when local already has an active contract', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 1 });
      mockTx.contract.findFirst.mockResolvedValue({ id: 99 });

      await expect(service.create(createDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException on Prisma P2002 (concurrent active contract)', async () => {
      mockPrisma.local.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 1 });
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );
      mockPrisma.$transaction.mockRejectedValueOnce(prismaError);

      await expect(service.create(createDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated contracts with activeRent mapped', async () => {
      const rent = { id: 1, amount: 500000, effectiveTo: null };
      mockPrisma.contract.findMany.mockResolvedValue([
        { id: 1, local: {}, tenant: {}, rents: [rent] },
      ]);
      mockPrisma.contract.count.mockResolvedValue(1);

      const result = await service.findAll({ skip: 0, take: 20 });

      expect(result).toMatchObject({ total: 1, skip: 0, take: 20 });
      expect(result.items[0].activeRent).toEqual(rent);
      expect(result.items[0]).not.toHaveProperty('rents');
    });

    it('should return null activeRent when no active rent exists', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([
        { id: 1, local: {}, tenant: {}, rents: [] },
      ]);
      mockPrisma.contract.count.mockResolvedValue(1);

      const result = await service.findAll({ skip: 0, take: 20 });

      expect(result.items[0].activeRent).toBeNull();
    });

    it('filtre par nom de local ou de locataire quand search est fourni', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await service.findAll({ skip: 0, take: 20, search: 'centre' });

      const expectedWhere = {
        status: { not: ContractStatus.CANCELED },
        OR: [
          { local: { name: { contains: 'centre', mode: 'insensitive' } } },
          { tenant: { name: { contains: 'centre', mode: 'insensitive' } } },
        ],
      };
      expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrisma.contract.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });

    it('exclut les contrats annulés (CANCELED) quand search est absent', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await service.findAll({ skip: 0, take: 20 });

      const expectedWhere = { status: { not: ContractStatus.CANCELED } };
      expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrisma.contract.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });
  });

  describe('findOne', () => {
    it('should return a contract with activeRent', async () => {
      const rent = { id: 1, amount: 500000, effectiveTo: null };
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        local: {},
        tenant: {},
        rents: [rent],
        deposit: null,
      });

      const result = await service.findOne(1);

      expect(result.activeRent).toEqual(rent);
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('inclut le document de bail dans le détail', async () => {
      const document = {
        id: 1,
        contractId: 1,
        documentNo: 'BAIL-2026-00001',
        s3Key: 'contracts/2026/BAIL-2026-00001.pdf',
      };
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        rents: [{ id: 1, effectiveTo: null }],
        document,
      });

      const result = await service.findOne(1);

      expect(result.document).toEqual(document);
      expect(mockPrisma.contract.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ document: true }),
        }),
      );
    });
  });

  describe('terminate', () => {
    const refundDto = {
      endDate: '2026-12-31',
      paymentDate: '2026-12-31',
      paymentMethod: PaymentMethod.CASH,
    };
    const contract = {
      id: 1,
      status: ContractStatus.ACTIVE,
      startDate: new Date('2026-01-01'),
      deposit: { id: 1 },
    };

    it('should terminate a contract, clean future rent dues and refund deposit', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(contract);
      mockPrisma.rentDue.count.mockResolvedValue(0);
      const terminated = {
        id: 1,
        status: ContractStatus.TERMINATED,
        rents: [{ id: 5, effectiveTo: null }],
      };
      mockTx.contract.findUniqueOrThrow.mockResolvedValue(terminated);
      mockPaymentsService.createDepositRefund.mockResolvedValue({ id: 42 });

      const result = await service.terminate(1, refundDto, 7);

      expect(mockTx.rentDue.deleteMany).toHaveBeenCalledWith({
        where: {
          contractId: 1,
          month: { gt: new Date('2026-12-31') },
          status: { in: [RentDueStatus.PENDING, RentDueStatus.LATE] },
        },
      });
      expect(mockTx.contract.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: ContractStatus.TERMINATED,
          endDate: new Date('2026-12-31'),
        },
      });
      expect(mockPaymentsService.createDepositRefund).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          contractId: 1,
          userId: 7,
          paymentMethod: PaymentMethod.CASH,
        }),
      );
      expect(mockPaymentsService.generateReceiptSafe).toHaveBeenCalledWith(42);
      expect(result).toEqual({
        ...terminated,
        activeRent: terminated.rents[0],
      });
    });

    it('should throw ConflictException when unpaid rent dues remain before endDate', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(contract);
      mockPrisma.rentDue.count.mockResolvedValue(2);

      await expect(service.terminate(1, refundDto, 7)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPaymentsService.createDepositRefund).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.terminate(999, refundDto, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when contract is not active', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.TERMINATED,
        deposit: { id: 1 },
      });

      await expect(service.terminate(1, refundDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when contract has no deposit', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
        deposit: null,
      });

      await expect(service.terminate(1, refundDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when endDate is before contract startDate', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(contract);

      await expect(
        service.terminate(1, { ...refundDto, endDate: '2025-06-01' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when endDate is in the future', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(contract);

      await expect(
        service.terminate(
          1,
          { ...refundDto, endDate: '2030-01-01', paymentDate: '2030-01-01' },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when refund paymentDate is in the future', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(contract);

      await expect(
        service.terminate(1, { ...refundDto, paymentDate: '2030-01-01' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when refund paymentDate is before contract start', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(contract);

      await expect(
        service.terminate(1, { ...refundDto, paymentDate: '2025-06-01' }, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    const cancelDto = {
      paymentDate: '2026-04-27',
      paymentMethod: PaymentMethod.CASH,
    };

    const activeContractWithDepositOnly = {
      id: 1,
      status: ContractStatus.ACTIVE,
      startDate: new Date('2026-01-01'),
      deposit: { id: 10 },
      payments: [{ id: 5, type: PaymentType.DEPOSIT_HELD }],
    };

    it('should cancel a contract, clean unpaid rent dues and refund deposit', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(
        activeContractWithDepositOnly,
      );
      mockPaymentsService.createDepositRefund.mockResolvedValue({ id: 99 });
      mockTx.contract.update.mockResolvedValue({
        id: 1,
        status: ContractStatus.CANCELED,
      });

      const result = await service.cancel(1, cancelDto, 7);

      expect(mockTx.rentDue.deleteMany).toHaveBeenCalledWith({
        where: {
          contractId: 1,
          status: { in: [RentDueStatus.PENDING, RentDueStatus.LATE] },
        },
      });
      expect(mockPaymentsService.createDepositRefund).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          contractId: 1,
          userId: 7,
          paymentDate: new Date('2026-04-27'),
          paymentMethod: PaymentMethod.CASH,
        }),
      );
      expect(mockTx.contract.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: ContractStatus.CANCELED },
      });
      expect(mockPaymentsService.generateReceiptSafe).toHaveBeenCalledWith(99);
      expect(result.status).toBe(ContractStatus.CANCELED);
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.cancel(999, cancelDto, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when contract is not active', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.CANCELED,
        deposit: { id: 10 },
        payments: [],
      });

      await expect(service.cancel(1, cancelDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when contract has no deposit', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
        deposit: null,
        payments: [],
      });

      await expect(service.cancel(1, cancelDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when rent payments exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.ACTIVE,
        startDate: new Date('2026-01-01'),
        deposit: { id: 10 },
        payments: [
          { id: 5, type: PaymentType.DEPOSIT_HELD },
          { id: 6, type: PaymentType.RENT },
        ],
      });

      await expect(service.cancel(1, cancelDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when refund paymentDate is in the future', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(
        activeContractWithDepositOnly,
      );

      await expect(
        service.cancel(1, { ...cancelDto, paymentDate: '2030-01-01' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when refund paymentDate is before contract start', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(
        activeContractWithDepositOnly,
      );

      await expect(
        service.cancel(1, { ...cancelDto, paymentDate: '2025-06-01' }, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
