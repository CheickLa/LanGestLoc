import { ApiProperty } from '@nestjs/swagger';
import { DepositStatus } from '@generated/prisma/client';

export class DepositEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  contractId: number;

  @ApiProperty({ example: 150000 })
  amount: number;

  @ApiProperty({ enum: DepositStatus, example: DepositStatus.HELD })
  status: DepositStatus;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: null, nullable: true })
  refundedAt: Date | null;
}
