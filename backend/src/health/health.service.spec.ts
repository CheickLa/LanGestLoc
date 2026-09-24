import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { HealthService } from './health.service';

const mockPrisma = { $queryRaw: jest.fn() };

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(HealthService);
    jest.clearAllMocks();
  });

  it('renvoie { status: "ok" } quand la base répond', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.check()).resolves.toEqual({ status: 'ok' });
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('lève une 503 quand la base est injoignable', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(service.check()).rejects.toThrow(ServiceUnavailableException);
  });
});
