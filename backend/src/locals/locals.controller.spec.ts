import { Test, TestingModule } from '@nestjs/testing';
import { LocalsController } from './locals.controller';
import { LocalsService } from './locals.service';

const mockLocalsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('LocalsController', () => {
  let controller: LocalsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocalsController],
      providers: [{ provide: LocalsService, useValue: mockLocalsService }],
    }).compile();

    controller = module.get<LocalsController>(LocalsController);
    jest.clearAllMocks();
  });

  describe('POST /locals', () => {
    it('should call service.create and return result', async () => {
      const dto = { code: 'LOCAL-001', name: 'Boutique 1' };
      mockLocalsService.create.mockResolvedValue({ id: 1, ...dto });

      const result = await controller.create(dto);

      expect(mockLocalsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 1, ...dto });
    });
  });

  describe('GET /locals', () => {
    it('should return all locals', async () => {
      const locals = [{ id: 1, code: 'LOCAL-001', name: 'B1' }];
      mockLocalsService.findAll.mockResolvedValue(locals);

      const result = await controller.findAll();

      expect(result).toEqual(locals);
    });
  });

  describe('GET /locals/:id', () => {
    it('should return a local by id', async () => {
      const local = { id: 1, code: 'LOCAL-001', name: 'B1' };
      mockLocalsService.findOne.mockResolvedValue(local);

      const result = await controller.findOne(1);

      expect(mockLocalsService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(local);
    });
  });

  describe('PATCH /locals/:id', () => {
    it('should call service.update and return result', async () => {
      const updated = { id: 1, code: 'LOCAL-001', name: 'Updated' };
      mockLocalsService.update.mockResolvedValue(updated);

      const result = await controller.update(1, { name: 'Updated' });

      expect(mockLocalsService.update).toHaveBeenCalledWith(1, { name: 'Updated' });
      expect(result).toEqual(updated);
    });
  });

  describe('DELETE /locals/:id', () => {
    it('should call service.remove and return result', async () => {
      mockLocalsService.remove.mockResolvedValue({ id: 1 });

      const result = await controller.remove(1);

      expect(mockLocalsService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1 });
    });
  });
});
