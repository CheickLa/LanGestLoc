import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthEntity } from './entities/health.entity';
import { HealthService } from './health.service';

@ApiTags('Santé')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // Publique et hors rate-limiting : appelée en boucle par le healthcheck Docker
  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: "État de l'API et de sa base de données" })
  @ApiOkResponse({
    description: 'API et base de données opérationnelles',
    type: HealthEntity,
  })
  @ApiResponse({ status: 503, description: 'Base de données injoignable' })
  check() {
    return this.healthService.check();
  }
}
