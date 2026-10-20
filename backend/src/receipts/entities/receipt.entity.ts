import { ApiProperty } from '@nestjs/swagger';

export class ReceiptEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  paymentId: number;

  @ApiProperty({ example: 'REC-2026-00042' })
  receiptNo: string;

  @ApiProperty({
    description: 'Clé du fichier PDF sur S3',
    example: 'receipts/42/REC-2026-00042.pdf',
  })
  s3Key: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;
}
