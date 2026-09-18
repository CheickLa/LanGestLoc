import { Test, TestingModule } from '@nestjs/testing';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractDocumentsService } from './contract-documents.service';
import { PaymentMethod, Role } from '@generated/prisma/client';
import type { Response } from 'express';

const mockContractsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  terminate: jest.fn(),
  cancel: jest.fn(),
};

const mockContractDocumentsService = {
  download: jest.fn(),
};

describe('ContractsController', () => {
  let controller: ContractsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [
        { provide: ContractsService, useValue: mockContractsService },
        {
          provide: ContractDocumentsService,
          useValue: mockContractDocumentsService,
        },
      ],
    }).compile();

    controller = module.get<ContractsController>(ContractsController);
    jest.clearAllMocks();
  });

  describe('POST /contracts', () => {
    it('should call service.create with dto and user id', async () => {
      const dto = {
        localId: 1,
        tenantId: 1,
        startDate: '2026-01-01',
        rentAmount: 500000,
        depositPaymentMethod: PaymentMethod.CASH,
        depositPaymentDate: '2026-01-01',
      };
      const user = { id: 1, email: 'admin@test.com', role: Role.ADMIN };
      mockContractsService.create.mockResolvedValue({ id: 1 });

      const result = await controller.create(dto, user);

      expect(mockContractsService.create).toHaveBeenCalledWith(dto, 1);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('GET /contracts', () => {
    it('should return paginated contracts', async () => {
      const paginated = { items: [{ id: 1 }], total: 1, skip: 0, take: 20 };
      mockContractsService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ skip: 0, take: 20 });

      expect(mockContractsService.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
      });
      expect(result).toEqual(paginated);
    });

    it('should forward the search query to the service', async () => {
      mockContractsService.findAll.mockResolvedValue({
        items: [],
        total: 0,
        skip: 0,
        take: 20,
      });

      await controller.findAll({ skip: 0, take: 20, search: 'centre' });

      expect(mockContractsService.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        search: 'centre',
      });
    });
  });

  describe('GET /contracts/:id', () => {
    it('should return a contract by id', async () => {
      mockContractsService.findOne.mockResolvedValue({ id: 1 });

      const result = await controller.findOne(1);

      expect(mockContractsService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('PATCH /contracts/:id/terminate', () => {
    it('should call service.terminate with dto and user id', async () => {
      const dto = {
        endDate: '2026-12-31',
        paymentDate: '2026-12-31',
        paymentMethod: PaymentMethod.CASH,
      };
      const user = { id: 7, email: 'admin@test.com', role: Role.ADMIN };
      mockContractsService.terminate.mockResolvedValue({
        id: 1,
        status: 'TERMINATED',
      });

      const result = await controller.terminate(1, dto, user);

      expect(mockContractsService.terminate).toHaveBeenCalledWith(1, dto, 7);
      expect(result?.status).toBe('TERMINATED');
    });
  });

  describe('PATCH /contracts/:id/cancel', () => {
    it('should call service.cancel with dto and user id', async () => {
      const dto = {
        paymentDate: '2026-04-27',
        paymentMethod: PaymentMethod.CASH,
      };
      const user = { id: 7, email: 'admin@test.com', role: Role.ADMIN };
      mockContractsService.cancel.mockResolvedValue({
        id: 1,
        status: 'CANCELED',
      });

      const result = await controller.cancel(1, dto, user);

      expect(mockContractsService.cancel).toHaveBeenCalledWith(1, dto, 7);
      expect(result.status).toBe('CANCELED');
    });
  });

  describe('GET /contracts/:id/document/download', () => {
    it('stream le PDF du bail avec les bons en-têtes', async () => {
      const buffer = Buffer.from('fake-pdf');
      mockContractDocumentsService.download.mockResolvedValue({
        buffer,
        documentNo: 'BAIL-2026-00001',
      });

      const mockRes = {
        set: jest.fn(),
        end: jest.fn(),
      } as unknown as Response;

      await controller.downloadDocument(1, mockRes);

      expect(mockContractDocumentsService.download).toHaveBeenCalledWith(1);
      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="BAIL-2026-00001.pdf"',
        'Content-Length': buffer.length,
      });
      expect(mockRes.end).toHaveBeenCalledWith(buffer);
    });
  });
});
