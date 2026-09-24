import { ApiProperty } from '@nestjs/swagger';

export class HealthEntity {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status: 'ok';
}
