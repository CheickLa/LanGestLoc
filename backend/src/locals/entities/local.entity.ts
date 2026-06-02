import { ApiProperty } from '@nestjs/swagger';

export class LocalEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'LOCAL-001' })
  code: string;

  @ApiProperty({ example: 'Boutique 1' })
  name: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;
}
