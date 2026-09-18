import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ReceiptsService } from '@/receipts/receipts.service';
import {
  ContractStatus,
  DepositStatus,
  PaymentMethod,
  PaymentType,
  Prisma,
  RentDueStatus,
} from '@generated/prisma/client';

const mockTx = {
  rentDue: {
    updateMany: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  payment: { create: jest.fn() },
  deposit: { findUnique: jest.fn(), update: jest.fn() },
};

const mockPrisma = {
  rentDue: { findMany: jest.fn() },
  contract: { findUnique: jest.fn() },
  payment: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(
    (arg: unknown[] | ((tx: typeof mockTx) => Promise<unknown>)) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(mockTx),
  ),
};

const mockReceiptsService = {
  generate: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2027-06-15'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ReceiptsService, useValue: mockReceiptsService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((arg) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(mockTx),
    );
  });

  const dto = {
    rentDueIds: [1, 2],
    paymentDate: '2026-04-01',
    paymentMethod: PaymentMethod.CASH,
  };

  const rentDues = [
    { id: 1, contractId: 1, amount: 500000, status: RentDueStatus.PENDING },
    { id: 2, contractId: 1, amount: 500000, status: RentDueStatus.LATE },
  ];

  const activeContract = {
    id: 1,
    status: ContractStatus.ACTIVE,
    startDate: new Date('2026-01-01'),
  };

  describe('create', () => {
    it('should create a payment, update rent dues, and generate receipt', async () => {
      mockPrisma.rentDue.findMany.mockResolvedValue(rentDues);
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);
      const payment = { id: 1, amount: 1000000, paymentLines: [] };
      mockTx.payment.create.mockResolvedValue(payment);
      mockReceiptsService.generate.mockResolvedValue({});

      const result = await service.create(dto, 1);

      expect(result).toEqual(payment);
      expect(mockTx.rentDue.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
        data: { status: RentDueStatus.PAID },
      });
      expect(mockTx.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contractId: 1,
          amount: 1000000,
          createdById: 1,
        }),
        include: expect.any(Object),
      });
      expect(mockReceiptsService.generate).toHaveBeenCalledWith(1);
    });

    it('should deduplicate rentDueIds', async () => {
      mockPrisma.rentDue.findMany.mockResolvedValue([rentDues[0]]);
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);
      mockTx.payment.create.mockResolvedValue({ id: 1, paymentLines: [] });

      await service.create({ ...dto, rentDueIds: [1, 1, 1] }, 1);

      expect(mockPrisma.rentDue.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1] } },
      });
    });

    it('should throw NotFoundException when some rent dues do not exist', async () => {
      mockPrisma.rentDue.findMany.mockResolvedValue([rentDues[0]]);

      await expect(service.create(dto, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when rent dues belong to different contracts', async () => {
      mockPrisma.rentDue.findMany.mockResolvedValue([
        { ...rentDues[0], contractId: 1 },
        { ...rentDues[1], contractId: 2 },
      ]);

      await expect(service.create(dto, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.rentDue.findMany.mockResolvedValue(rentDues);
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when contract is canceled', async () => {
      mockPrisma.rentDue.findMany.mockResolvedValue(rentDues);
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.CANCELED,
        startDate: new Date('2026-01-01'),
      });

      await expect(service.create(dto, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when contract is terminated', async () => {
      mockPrisma.rentDue.findMany.mockResolvedValue(rentDues);
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 1,
        status: ContractStatus.TERMINATED,
        startDate: new Date('2026-01-01'),
      });

      await expect(service.create(dto, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when paymentDate is in the future', async () => {
      mockPrisma.rentDue.findMany.mockResolvedValue(rentDues);
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);

      await expect(
        service.create({ ...dto, paymentDate: '2030-01-01' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when paymentDate is before contract start', async () => {
      mockPrisma.rentDue.findMany.mockResolvedValue(rentDues);
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);

      await expect(
        service.create({ ...dto, paymentDate: '2025-12-01' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when rent dues are already paid', async () => {
      mockPrisma.rentDue.findMany.mockResolvedValue([
        { ...rentDues[0], status: RentDueStatus.PAID },
        rentDues[1],
      ]);
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);

      await expect(service.create(dto, 1)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException on Prisma P2002 (concurrent payment)', async () => {
      mockPrisma.rentDue.findMany.mockResolvedValue(rentDues);
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );
      mockPrisma.$transaction.mockRejectedValue(prismaError);

      await expect(service.create(dto, 1)).rejects.toThrow(ConflictException);
    });

    it('should not fail payment if receipt generation fails', async () => {
      mockPrisma.rentDue.findMany.mockResolvedValue(rentDues);
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);
      const payment = { id: 1, amount: 1000000, paymentLines: [] };
      mockTx.payment.create.mockResolvedValue(payment);
      mockReceiptsService.generate.mockRejectedValue(new Error('S3 down'));

      const result = await service.create(dto, 1);

      expect(result).toEqual(payment);
    });
  });

  describe('findAll', () => {
    it('should return paginated payments with relations', async () => {
      const payments = [{ id: 1, amount: 1000000 }];
      mockPrisma.payment.findMany.mockResolvedValue(payments);
      mockPrisma.payment.count.mockResolvedValue(1);

      const result = await service.findAll({ skip: 0, take: 20 });

      expect(result).toEqual({ items: payments, total: 1, skip: 0, take: 20 });
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        include: {
          paymentLines: { include: { rentDue: true } },
          contract: { include: { tenant: true, local: true } },
        },
        orderBy: { paymentDate: 'desc' },
      });
    });
  });

  describe('findAllByContract', () => {
    it('should return payments for a contract', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(activeContract);
      const payments = [{ id: 1 }];
      mockPrisma.payment.findMany.mockResolvedValue(payments);

      const result = await service.findAllByContract(1);

      expect(result).toEqual(payments);
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      await expect(service.findAllByContract(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a payment with all relations', async () => {
      const payment = { id: 1, amount: 1000000, receipt: null };
      mockPrisma.payment.findUnique.mockResolvedValue(payment);

      const result = await service.findOne(1);

      expect(result).toEqual(payment);
      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          paymentLines: { include: { rentDue: true } },
          contract: { include: { tenant: true, local: true } },
          receipt: true,
        },
      });
    });

    it('should throw NotFoundException when payment does not exist', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createDepositHeld', () => {
    const params = {
      contractId: 1,
      amount: 500000,
      userId: 7,
      paymentDate: new Date('2026-01-01'),
      paymentMethod: PaymentMethod.CASH,
    };

    it('should create a DEPOSIT_HELD payment without payment lines', async () => {
      mockTx.payment.create.mockResolvedValue({ id: 33 });

      const result = await service.createDepositHeld(
        mockTx as unknown as Prisma.TransactionClient,
        params,
      );

      expect(mockTx.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contractId: 1,
          type: PaymentType.DEPOSIT_HELD,
          amount: 500000,
          paymentDate: params.paymentDate,
          paymentMethod: PaymentMethod.CASH,
          createdById: 7,
        }),
      });
      expect(mockTx.payment.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ paymentLines: expect.anything() }),
      });
      expect(result).toEqual({ id: 33 });
    });
  });

  describe('createDepositRefund', () => {
    const params = {
      contractId: 1,
      userId: 7,
      paymentDate: new Date('2026-12-31'),
      paymentMethod: PaymentMethod.CASH,
    };
    const held = { id: 10, status: DepositStatus.HELD, amount: 500000 };

    it('should create DEPOSIT_REFUND payment and mark deposit REFUNDED', async () => {
      mockTx.deposit.findUnique.mockResolvedValue(held);
      mockTx.rentDue.count.mockResolvedValue(0);
      mockTx.payment.create.mockResolvedValue({ id: 88 });

      const result = await service.createDepositRefund(
        mockTx as unknown as Prisma.TransactionClient,
        params,
      );

      expect(mockTx.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contractId: 1,
          type: PaymentType.DEPOSIT_REFUND,
          amount: 500000,
          paymentMethod: PaymentMethod.CASH,
          createdById: 7,
        }),
      });
      expect(mockTx.deposit.update).toHaveBeenCalledWith({
        where: { contractId: 1 },
        data: expect.objectContaining({ status: DepositStatus.REFUNDED }),
      });
      expect(result).toEqual({ id: 88 });
    });

    it('should throw NotFoundException when deposit does not exist', async () => {
      mockTx.deposit.findUnique.mockResolvedValue(null);

      await expect(
        service.createDepositRefund(
          mockTx as unknown as Prisma.TransactionClient,
          params,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when deposit is not HELD', async () => {
      mockTx.deposit.findUnique.mockResolvedValue({
        ...held,
        status: DepositStatus.REFUNDED,
      });

      await expect(
        service.createDepositRefund(
          mockTx as unknown as Prisma.TransactionClient,
          params,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when unpaid rent dues remain', async () => {
      mockTx.deposit.findUnique.mockResolvedValue(held);
      mockTx.rentDue.count.mockResolvedValue(2);

      await expect(
        service.createDepositRefund(
          mockTx as unknown as Prisma.TransactionClient,
          params,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('generateReceiptSafe', () => {
    it('should call receiptsService.generate and swallow errors', async () => {
      mockReceiptsService.generate.mockRejectedValue(new Error('S3 down'));

      await expect(service.generateReceiptSafe(42)).resolves.toBeUndefined();
      expect(mockReceiptsService.generate).toHaveBeenCalledWith(42);
    });
  });
});
