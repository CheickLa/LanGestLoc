import { Test, TestingModule } from '@nestjs/testing';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReceiptsService } from './receipts.service';
import { PrismaService } from '@/prisma/prisma.service';
import { S3Service } from '@/s3/s3.service';
import * as pdfBuilder from './pdf/pdf-builder';

const mockTx = {
  receipt: { findFirst: jest.fn(), create: jest.fn() },
};

type MockTx = typeof mockTx;

const runInTransaction = <T>(cb: (tx: MockTx) => Promise<T>) => cb(mockTx);

const mockPrisma = {
  receipt: { findUnique: jest.fn() },
  payment: { findUnique: jest.fn() },
  $transaction: jest.fn(runInTransaction),
};

const mockS3 = {
  upload: jest.fn(),
  getObject: jest.fn(),
};

const mockConfig = {
  getOrThrow: jest.fn((key: string) => {
    if (key === 'BAILLEUR_NAME') return 'Test Bailleur';
    if (key === 'BAILLEUR_LIEU') return 'Conakry';
    return '';
  }),
};

jest
  .spyOn(pdfBuilder, 'buildReceiptPdf')
  .mockResolvedValue(Buffer.from('fake-pdf'));

describe('ReceiptsService', () => {
  let service: ReceiptsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3 },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<ReceiptsService>(ReceiptsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(runInTransaction);
  });

  describe('generate', () => {
    const payment = {
      id: 1,
      contract: { tenant: { name: 'Tenant' }, local: { name: 'Local' } },
      paymentLines: [{ rentDue: { month: new Date(), amount: 500000 } }],
      amount: 500000,
      paymentMethod: 'CASH',
      paymentDate: new Date(),
    };

    it('should return existing receipt if already generated', async () => {
      const existing = { id: 1, paymentId: 1, receiptNo: 'REC-2026-00001' };
      mockPrisma.receipt.findUnique.mockResolvedValue(existing);

      const result = await service.generate(1);

      expect(result).toEqual(existing);
      expect(mockPrisma.payment.findUnique).not.toHaveBeenCalled();
    });

    it('should generate a new receipt with sequential number', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue(payment);
      mockTx.receipt.findFirst.mockResolvedValue({
        receiptNo: 'REC-2026-00003',
      });
      const created = { id: 1, paymentId: 1, receiptNo: 'REC-2026-00004' };
      mockTx.receipt.create.mockResolvedValue(created);

      const result = await service.generate(1);

      expect(result).toEqual(created);
      expect(mockS3.upload).toHaveBeenCalledWith(
        expect.stringContaining('receipts/'),
        expect.any(Buffer),
        'application/pdf',
      );
      expect(mockTx.receipt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paymentId: 1,
          receiptNo: 'REC-2026-00004',
        }),
      });
    });

    it('should start at 1 when no previous receipt exists for the year', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue(payment);
      mockTx.receipt.findFirst.mockResolvedValue(null);
      mockTx.receipt.create.mockResolvedValue({
        id: 1,
        receiptNo: 'REC-2026-00001',
      });

      await service.generate(1);

      expect(mockTx.receipt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          receiptNo: expect.stringContaining('-00001'),
        }),
      });
    });

    it('should throw NotFoundException when payment does not exist', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.generate(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPayment', () => {
    it('should return the receipt for a payment', async () => {
      const receipt = { id: 1, paymentId: 1, receiptNo: 'REC-2026-00001' };
      mockPrisma.receipt.findUnique.mockResolvedValue(receipt);

      const result = await service.findByPayment(1);

      expect(result).toEqual(receipt);
    });

    it('should throw NotFoundException when no receipt exists', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue(null);

      await expect(service.findByPayment(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('download', () => {
    it('should return buffer and receiptNo', async () => {
      const receipt = {
        id: 1,
        receiptNo: 'REC-2026-00001',
        s3Key: 'receipts/2026/REC-2026-00001.pdf',
      };
      mockPrisma.receipt.findUnique.mockResolvedValue(receipt);
      const pdfBuffer = Buffer.from('pdf-content');
      mockS3.getObject.mockResolvedValue(pdfBuffer);

      const result = await service.download(1);

      expect(result).toEqual({
        buffer: pdfBuffer,
        receiptNo: 'REC-2026-00001',
      });
      expect(mockS3.getObject).toHaveBeenCalledWith(
        'receipts/2026/REC-2026-00001.pdf',
      );
    });

    it('should throw NotFoundException when receipt does not exist', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue(null);

      await expect(service.download(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException when S3 fails', async () => {
      const receipt = {
        id: 1,
        receiptNo: 'REC-2026-00001',
        s3Key: 'receipts/2026/REC-2026-00001.pdf',
      };
      mockPrisma.receipt.findUnique.mockResolvedValue(receipt);
      mockS3.getObject.mockRejectedValue(new Error('S3 down'));

      await expect(service.download(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
