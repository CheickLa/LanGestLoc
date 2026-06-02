import { ApiProperty } from '@nestjs/swagger';

/**
 * Pattern SCD : effectiveTo = null sur le loyer actif.
 */
export class RentEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  contractId: number;

  @ApiProperty({ example: 150000 })
  amount: number;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  effectiveFrom: Date;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z', nullable: true })
  effectiveTo: Date | null;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;
}
