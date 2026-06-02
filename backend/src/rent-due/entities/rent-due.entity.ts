import { ApiProperty } from '@nestjs/swagger';
import { RentDueStatus } from '@generated/prisma/client';

export class RentDueEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  contractId: number;

  @ApiProperty({ example: 1 })
  rentId: number;

  @ApiProperty({ description: '1er du mois à 00:00:00 UTC', example: '2026-01-01T00:00:00.000Z' })
  month: Date;

  @ApiProperty({ example: 150000 })
  amount: number;

  @ApiProperty({ example: '2026-02-05T00:00:00.000Z' })
  dueDate: Date;

  @ApiProperty({ enum: RentDueStatus, example: RentDueStatus.PENDING })
  status: RentDueStatus;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
