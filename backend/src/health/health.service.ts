import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { HealthEntity } from './entities/health.entity';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Vérifie que l'API répond et que sa base de données est joignable */
  async check(): Promise<HealthEntity> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Base de données injoignable');
    }
    return { status: 'ok' };
  }
}
