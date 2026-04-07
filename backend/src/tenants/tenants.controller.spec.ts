import { Test, TestingModule } from '@nestjs/testing';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

const mockTenantsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('TenantsController', () => {
  let controller: TenantsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [{ provide: TenantsService, useValue: mockTenantsService }],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
    jest.clearAllMocks();
  });

  describe('POST /tenants', () => {
    it('should call service.create and return result', async () => {
      const dto = { name: 'Jean', phone: '060102', dateOfBirth: '1990-01-15', idNumber: 'ID123' };
      mockTenantsService.create.mockResolvedValue({ id: 1, ...dto });

      const result = await controller.create(dto);

      expect(mockTenantsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 1, ...dto });
    });
  });

  describe('GET /tenants', () => {
    it('should return all tenants', async () => {
      const tenants = [{ id: 1, name: 'Jean' }];
      mockTenantsService.findAll.mockResolvedValue(tenants);

      const result = await controller.findAll();

      expect(result).toEqual(tenants);
    });
  });

  describe('GET /tenants/:id', () => {
    it('should return a tenant by id', async () => {
      const tenant = { id: 1, name: 'Jean' };
      mockTenantsService.findOne.mockResolvedValue(tenant);

      const result = await controller.findOne(1);

      expect(mockTenantsService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(tenant);
    });
  });

  describe('PATCH /tenants/:id', () => {
    it('should call service.update and return result', async () => {
      const updated = { id: 1, name: 'Updated' };
      mockTenantsService.update.mockResolvedValue(updated);

      const result = await controller.update(1, { name: 'Updated' });

      expect(mockTenantsService.update).toHaveBeenCalledWith(1, { name: 'Updated' });
      expect(result).toEqual(updated);
    });
  });

  describe('DELETE /tenants/:id', () => {
    it('should call service.remove and return result', async () => {
      mockTenantsService.remove.mockResolvedValue({ id: 1 });

      const result = await controller.remove(1);

      expect(mockTenantsService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1 });
    });
  });
});
