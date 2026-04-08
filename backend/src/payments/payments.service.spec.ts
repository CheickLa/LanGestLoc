import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ReceiptsService } from '@/receipts/receipts.service';
import { ContractStatus, PaymentMethod, RentDueStatus } from '@generated/prisma/client';

const mockTx = {
  rentDue: { updateMany: jest.fn() },
  payment: { create: jest.fn() },
};

const mockPrisma = {
  rentDue: { findMany: jest.fn() },
  contract: { findUnique: jest.fn() },
  payment: { findMany: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn((cb) => cb(mockTx)),
};

const mockReceiptsService = {
  generate: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

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
    mockPrisma.$transaction.mockImplementation((cb) => cb(mockTx));
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

  const activeContract = { id: 1, status: ContractStatus.ACTIVE };

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
      mockPrisma.contract.findUnique.mockResolvedValue({ id: 1, status: ContractStatus.CANCELED });

      await expect(service.create(dto, 1)).rejects.toThrow(BadRequestException);
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
      mockPrisma.$transaction.mockRejectedValue({ code: 'P2002' });

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
    it('should return all payments with relations', async () => {
      const payments = [{ id: 1, amount: 1000000 }];
      mockPrisma.payment.findMany.mockResolvedValue(payments);

      const result = await service.findAll();

      expect(result).toEqual(payments);
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith({
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

      await expect(service.findAllByContract(999)).rejects.toThrow(NotFoundException);
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
});
