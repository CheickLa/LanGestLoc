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

export class CurrentTenantEntity {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ example: 'Ibrahima Sow' })
  name: string;
}

export class LocalListItemEntity extends LocalEntity {
  @ApiProperty({
    enum: ['OCCUPIED', 'VACANT'],
    example: 'OCCUPIED',
    description: 'Dérivé : OCCUPIED si un contrat ACTIVE existe, sinon VACANT',
  })
  status: 'OCCUPIED' | 'VACANT';

  @ApiProperty({
    type: () => CurrentTenantEntity,
    nullable: true,
    description: 'Locataire du contrat ACTIVE, ou null si vacant',
  })
  currentTenant: CurrentTenantEntity | null;

  @ApiProperty({
    example: true,
    description: 'Au moins un contrat (tout statut) rattaché → suppression bloquée',
  })
  hasContracts: boolean;
}
