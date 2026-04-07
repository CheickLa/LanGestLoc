import { Test, TestingModule } from '@nestjs/testing';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { DepositAction } from './dto/terminate-contract.dto';

const mockContractsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  terminate: jest.fn(),
  cancel: jest.fn(),
};

describe('ContractsController', () => {
  let controller: ContractsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [{ provide: ContractsService, useValue: mockContractsService }],
    }).compile();

    controller = module.get<ContractsController>(ContractsController);
    jest.clearAllMocks();
  });

  describe('POST /contracts', () => {
    it('should call service.create with dto and user id', async () => {
      const dto = { localId: 1, tenantId: 1, startDate: '2026-01-01', rentAmount: 500000 };
      const user = { id: 1, email: 'admin@test.com', role: 'ADMIN' as any };
      mockContractsService.create.mockResolvedValue({ id: 1 });

      const result = await controller.create(dto, user);

      expect(mockContractsService.create).toHaveBeenCalledWith(dto, 1);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('GET /contracts', () => {
    it('should return all contracts', async () => {
      mockContractsService.findAll.mockResolvedValue([{ id: 1 }]);

      const result = await controller.findAll();

      expect(result).toEqual([{ id: 1 }]);
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
    it('should call service.terminate', async () => {
      const dto = { endDate: '2026-12-31', depositAction: DepositAction.REFUNDED };
      mockContractsService.terminate.mockResolvedValue({ id: 1, status: 'TERMINATED' });

      const result = await controller.terminate(1, dto);

      expect(mockContractsService.terminate).toHaveBeenCalledWith(1, dto);
      expect(result.status).toBe('TERMINATED');
    });
  });

  describe('PATCH /contracts/:id/cancel', () => {
    it('should call service.cancel', async () => {
      mockContractsService.cancel.mockResolvedValue({ id: 1, status: 'CANCELED' });

      const result = await controller.cancel(1);

      expect(mockContractsService.cancel).toHaveBeenCalledWith(1);
      expect(result.status).toBe('CANCELED');
    });
  });
});
