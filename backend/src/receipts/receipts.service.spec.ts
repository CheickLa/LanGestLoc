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
import { Prisma } from '@generated/prisma/client';

const mockPrisma = {
  receipt: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  payment: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

const mockS3 = {
  upload: jest.fn(),
  getObject: jest.fn(),
};

const mockConfig = {
  getOrThrow: (key: string) => {
    if (key === 'BAILLEUR_NAME') return 'Test Bailleur';
    if (key === 'BAILLEUR_LIEU') return 'Conakry';
    return '';
  },
};

const buildReceiptPdf = jest.spyOn(pdfBuilder, 'buildReceiptPdf');

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: '7.0.0',
  });

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
    jest.resetAllMocks();
    buildReceiptPdf.mockImplementation((_payment, receiptNo) =>
      Promise.resolve(Buffer.from(`pdf ${receiptNo}`)),
    );
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
    const year = new Date().getUTCFullYear();

    const givenNewReceipt = () => {
      mockPrisma.receipt.findUnique.mockResolvedValue(null);
      mockPrisma.payment.findUnique.mockResolvedValue(payment);
    };

    it('should return existing receipt if already generated', async () => {
      const existing = { id: 1, paymentId: 1, receiptNo: 'REC-2026-00001' };
      mockPrisma.receipt.findUnique.mockResolvedValue(existing);

      const result = await service.generate(1);

      expect(result).toEqual(existing);
      expect(mockPrisma.payment.findUnique).not.toHaveBeenCalled();
      expect(mockS3.upload).not.toHaveBeenCalled();
    });

    it('should generate a new receipt with sequential number', async () => {
      givenNewReceipt();
      mockPrisma.receipt.findFirst.mockResolvedValue({
        receiptNo: `REC-${year}-00003`,
      });
      const created = { id: 1, paymentId: 1, receiptNo: `REC-${year}-00004` };
      mockPrisma.receipt.create.mockResolvedValue(created);

      const result = await service.generate(1);

      expect(result).toEqual(created);
      expect(mockPrisma.receipt.create).toHaveBeenCalledWith({
        data: {
          paymentId: 1,
          receiptNo: `REC-${year}-00004`,
          s3Key: `receipts/1/REC-${year}-00004.pdf`,
        },
      });
    });

    it('should start at 1 when no previous receipt exists for the year', async () => {
      givenNewReceipt();
      mockPrisma.receipt.findFirst.mockResolvedValue(null);
      mockPrisma.receipt.create.mockResolvedValue({ id: 1 });

      await service.generate(1);

      expect(mockPrisma.receipt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ receiptNo: `REC-${year}-00001` }),
      });
    });

    it('charge le local, le locataire et le bail avec le paiement', async () => {
      givenNewReceipt();
      mockPrisma.receipt.findFirst.mockResolvedValue(null);
      mockPrisma.receipt.create.mockResolvedValue({ id: 1 });

      await service.generate(1);

      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          contract: { include: { tenant: true, local: true, document: true } },
          paymentLines: { include: { rentDue: true } },
        },
      });
    });

    it("n'envoie rien sur S3 dans une transaction", async () => {
      givenNewReceipt();
      mockPrisma.receipt.findFirst.mockResolvedValue(null);
      mockPrisma.receipt.create.mockResolvedValue({ id: 1 });

      await service.generate(1);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('envoie le PDF avant de créer le reçu, sous une clé propre au paiement', async () => {
      givenNewReceipt();
      mockPrisma.receipt.findFirst.mockResolvedValue(null);
      mockPrisma.receipt.create.mockResolvedValue({ id: 1 });

      await service.generate(1);

      expect(mockS3.upload).toHaveBeenCalledWith(
        `receipts/1/REC-${year}-00001.pdf`,
        Buffer.from(`pdf REC-${year}-00001`),
        'application/pdf',
      );
      expect(mockS3.upload.mock.invocationCallOrder[0]).toBeLessThan(
        mockPrisma.receipt.create.mock.invocationCallOrder[0],
      );
    });

    it("ne crée pas de reçu si l'envoi sur S3 échoue", async () => {
      givenNewReceipt();
      mockPrisma.receipt.findFirst.mockResolvedValue(null);
      mockS3.upload.mockRejectedValueOnce(new Error('S3 down'));

      await expect(service.generate(1)).rejects.toThrow('S3 down');
      expect(mockPrisma.receipt.create).not.toHaveBeenCalled();
    });

    it('reprend le numéro suivant si un autre paiement a pris le même', async () => {
      givenNewReceipt();
      mockPrisma.receipt.findFirst
        .mockResolvedValueOnce({ receiptNo: `REC-${year}-00003` })
        .mockResolvedValueOnce({ receiptNo: `REC-${year}-00004` });
      const created = { id: 2, paymentId: 1, receiptNo: `REC-${year}-00005` };
      mockPrisma.receipt.create
        .mockRejectedValueOnce(uniqueViolation())
        .mockResolvedValueOnce(created);

      const result = await service.generate(1);

      expect(result).toEqual(created);
      expect(mockS3.upload).toHaveBeenLastCalledWith(
        `receipts/1/REC-${year}-00005.pdf`,
        Buffer.from(`pdf REC-${year}-00005`),
        'application/pdf',
      );
      expect(mockPrisma.receipt.create).toHaveBeenLastCalledWith({
        data: {
          paymentId: 1,
          receiptNo: `REC-${year}-00005`,
          s3Key: `receipts/1/REC-${year}-00005.pdf`,
        },
      });
    });

    it('renvoie le reçu créé en même temps pour le même paiement', async () => {
      const raced = { id: 7, paymentId: 1, receiptNo: `REC-${year}-00004` };
      mockPrisma.receipt.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(raced);
      mockPrisma.payment.findUnique.mockResolvedValue(payment);
      mockPrisma.receipt.findFirst.mockResolvedValue(null);
      mockPrisma.receipt.create.mockRejectedValueOnce(uniqueViolation());

      const result = await service.generate(1);

      expect(result).toEqual(raced);
      expect(mockPrisma.receipt.create).toHaveBeenCalledTimes(1);
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
