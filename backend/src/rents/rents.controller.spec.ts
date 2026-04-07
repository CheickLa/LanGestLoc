import { Test, TestingModule } from '@nestjs/testing';
import { RentsController } from './rents.controller';
import { RentsService } from './rents.service';

const mockRentsService = {
  create: jest.fn(),
  findAllByContract: jest.fn(),
  findCurrent: jest.fn(),
};

describe('RentsController', () => {
  let controller: RentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RentsController],
      providers: [{ provide: RentsService, useValue: mockRentsService }],
    }).compile();

    controller = module.get<RentsController>(RentsController);
    jest.clearAllMocks();
  });

  describe('POST /rents', () => {
    it('should call service.create and return result', async () => {
      const dto = { contractId: 1, amount: 600000, effectiveFrom: '2026-04-01' };
      mockRentsService.create.mockResolvedValue({ id: 2, ...dto });

      const result = await controller.create(dto);

      expect(mockRentsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 2, ...dto });
    });
  });

  describe('GET /rents/contract/:contractId', () => {
    it('should return all rents for a contract', async () => {
      mockRentsService.findAllByContract.mockResolvedValue([{ id: 1 }]);

      const result = await controller.findAllByContract(1);

      expect(mockRentsService.findAllByContract).toHaveBeenCalledWith(1);
      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('GET /rents/contract/:contractId/current', () => {
    it('should return the current rent', async () => {
      mockRentsService.findCurrent.mockResolvedValue({ id: 1, amount: 500000 });

      const result = await controller.findCurrent(1);

      expect(mockRentsService.findCurrent).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1, amount: 500000 });
    });
  });
});
