import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

const mockDashboardService = {
  summary: jest.fn(),
  lateContracts: jest.fn(),
};

describe('DashboardController', () => {
  let controller: DashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: mockDashboardService },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    jest.clearAllMocks();
  });

  describe('GET /dashboard', () => {
    it('should return the summary of the service', async () => {
      const summary = { collected: { amount: 1500000, payments: 1 } };
      mockDashboardService.summary.mockResolvedValue(summary);

      const result = await controller.summary();

      expect(mockDashboardService.summary).toHaveBeenCalledWith();
      expect(result).toEqual(summary);
    });
  });

  describe('GET /dashboard/late-contracts', () => {
    it('should return the late contracts page of the service', async () => {
      const page = { items: [], total: 0, skip: 0, take: 20 };
      mockDashboardService.lateContracts.mockResolvedValue(page);
      const query = { skip: 0, take: 20 };

      const result = await controller.lateContracts(query);

      expect(mockDashboardService.lateContracts).toHaveBeenCalledWith(query);
      expect(result).toEqual(page);
    });
  });
});
