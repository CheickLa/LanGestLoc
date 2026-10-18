import { ApiProperty } from '@nestjs/swagger';
import type { PayableStatus } from '../payable-months';

export class PayableMonthEntity {
  @ApiProperty({
    description: '1er du mois à 00:00:00 UTC',
    example: '2026-11-01T00:00:00.000Z',
  })
  month: Date;

  @ApiProperty({ example: 1500000 })
  amount: number;

  @ApiProperty({ enum: ['LATE', 'PENDING', 'ADVANCE'], example: 'ADVANCE' })
  status: PayableStatus;
}
