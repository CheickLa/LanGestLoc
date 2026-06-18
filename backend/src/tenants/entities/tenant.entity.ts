import { ApiProperty } from '@nestjs/swagger';

export class TenantEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Aminata Barry' })
  name: string;

  @ApiProperty({ example: 'Commerçant', nullable: true })
  activity: string | null;

  @ApiProperty({ example: '+224612345678' })
  phone: string;

  @ApiProperty({ example: '1990-05-15T00:00:00.000Z' })
  dateOfBirth: Date;

  @ApiProperty({ example: 'Conakry' })
  birthPlace: string;

  @ApiProperty({ example: '234567890' })
  idNumber: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;
}

export class TenantListItemEntity extends TenantEntity {
  @ApiProperty({
    example: true,
    description: 'Au moins un contrat rattaché → suppression bloquée',
  })
  hasContracts: boolean;
}
