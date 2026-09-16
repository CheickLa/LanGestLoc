import { ApiProperty } from '@nestjs/swagger';

/** Contrat de bail PDF associé à un contrat (référence S3) */
export class ContractDocumentEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  contractId: number;

  @ApiProperty({ example: 'BAIL-2026-00001' })
  documentNo: string;

  @ApiProperty({ example: 'contracts/1/BAIL-2026-00001.pdf' })
  s3Key: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;
}
