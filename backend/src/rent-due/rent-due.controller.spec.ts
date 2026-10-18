import { Test, TestingModule } from '@nestjs/testing';
import { RentDueController } from './rent-due.controller';
import { RentDueService } from './rent-due.service';

const mockRentDueService = {
  generate: jest.fn(),
  findAllByContract: jest.fn(),
  findPayable: jest.fn(),
  generateForAllActiveContracts: jest.fn(),
  markOverdueAsLate: jest.fn(),
};

describe('RentDueController', () => {
  let controller: RentDueController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RentDueController],
      providers: [{ provide: RentDueService, useValue: mockRentDueService }],
    }).compile();

    controller = module.get<RentDueController>(RentDueController);
    jest.clearAllMocks();
  });

  describe('POST /rent-dues/generate', () => {
    it('should call service.generate and return result', async () => {
      const dto = { contractId: 1, month: '2026-04' };
      mockRentDueService.generate.mockResolvedValue({ id: 1, ...dto });

      const result = await controller.generate(dto);

      expect(mockRentDueService.generate).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 1, ...dto });
    });
  });

  describe('GET /rent-dues/contract/:contractId', () => {
    it('should return all rent dues for a contract', async () => {
      mockRentDueService.findAllByContract.mockResolvedValue([{ id: 1 }]);

      const result = await controller.findAllByContract(1);

      expect(mockRentDueService.findAllByContract).toHaveBeenCalledWith(1);
      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('GET /rent-dues/contract/:contractId/payable', () => {
    it('renvoie les mois payables du contrat', async () => {
      const months = [
        { month: new Date('2026-11-01'), amount: 1500000, status: 'ADVANCE' },
      ];
      mockRentDueService.findPayable.mockResolvedValue(months);

      const result = await controller.findPayable(1);

      expect(mockRentDueService.findPayable).toHaveBeenCalledWith(1);
      expect(result).toEqual(months);
    });
  });

  describe('POST /rent-dues/cron/generate', () => {
    it('should trigger cron generation', async () => {
      mockRentDueService.generateForAllActiveContracts.mockResolvedValue(
        undefined,
      );

      await controller.triggerGenerate();

      expect(
        mockRentDueService.generateForAllActiveContracts,
      ).toHaveBeenCalled();
    });
  });

  describe('POST /rent-dues/cron/mark-late', () => {
    it('should trigger cron mark-late', async () => {
      mockRentDueService.markOverdueAsLate.mockResolvedValue(undefined);

      await controller.triggerMarkLate();

      expect(mockRentDueService.markOverdueAsLate).toHaveBeenCalled();
    });
  });
});
