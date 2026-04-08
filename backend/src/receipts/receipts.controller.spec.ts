import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';

const mockReceiptsService = {
  findByPayment: jest.fn(),
  download: jest.fn(),
};

describe('ReceiptsController', () => {
  let controller: ReceiptsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReceiptsController],
      providers: [{ provide: ReceiptsService, useValue: mockReceiptsService }],
    }).compile();

    controller = module.get<ReceiptsController>(ReceiptsController);
    jest.clearAllMocks();
  });

  describe('GET /receipts/payment/:paymentId', () => {
    it('should return the receipt for a payment', async () => {
      const receipt = { id: 1, paymentId: 1, receiptNo: 'REC-2026-00001' };
      mockReceiptsService.findByPayment.mockResolvedValue(receipt);

      const result = await controller.findByPayment(1);

      expect(mockReceiptsService.findByPayment).toHaveBeenCalledWith(1);
      expect(result).toEqual(receipt);
    });
  });

  describe('GET /receipts/:id/download', () => {
    it('should stream PDF with correct headers', async () => {
      const buffer = Buffer.from('fake-pdf');
      mockReceiptsService.download.mockResolvedValue({ buffer, receiptNo: 'REC-2026-00001' });

      const mockRes = {
        set: jest.fn(),
        end: jest.fn(),
      } as any;

      await controller.download(1, mockRes);

      expect(mockReceiptsService.download).toHaveBeenCalledWith(1);
      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="REC-2026-00001.pdf"',
        'Content-Length': buffer.length,
      });
      expect(mockRes.end).toHaveBeenCalledWith(buffer);
    });
  });
});
