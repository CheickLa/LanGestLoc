import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentMethod } from '@generated/prisma/client';

const mockPaymentsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findAllByContract: jest.fn(),
  findOne: jest.fn(),
};

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    jest.clearAllMocks();
  });

  describe('POST /payments', () => {
    it('should call service.create with dto and user id', async () => {
      const dto = { rentDueIds: [1, 2], paymentDate: '2026-04-01', paymentMethod: PaymentMethod.CASH };
      const user = { id: 1 };
      mockPaymentsService.create.mockResolvedValue({ id: 1, amount: 1000000 });

      const result = await controller.create(dto, user);

      expect(mockPaymentsService.create).toHaveBeenCalledWith(dto, 1);
      expect(result).toEqual({ id: 1, amount: 1000000 });
    });
  });

  describe('GET /payments', () => {
    it('should return paginated payments', async () => {
      const paginated = { items: [{ id: 1 }], total: 1, skip: 0, take: 20 };
      mockPaymentsService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ skip: 0, take: 20 });

      expect(mockPaymentsService.findAll).toHaveBeenCalledWith({ skip: 0, take: 20 });
      expect(result).toEqual(paginated);
    });
  });

  describe('GET /payments/contract/:contractId', () => {
    it('should return payments for a contract', async () => {
      mockPaymentsService.findAllByContract.mockResolvedValue([{ id: 1 }]);

      const result = await controller.findAllByContract(1);

      expect(mockPaymentsService.findAllByContract).toHaveBeenCalledWith(1);
      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('GET /payments/:id', () => {
    it('should return a payment by id', async () => {
      mockPaymentsService.findOne.mockResolvedValue({ id: 1, amount: 1000000 });

      const result = await controller.findOne(1);

      expect(mockPaymentsService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1, amount: 1000000 });
    });
  });
});
