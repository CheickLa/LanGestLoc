import { ApiProperty } from '@nestjs/swagger';

export class DashboardCollectedEntity {
  @ApiProperty({ example: 9000000 })
  amount: number;

  @ApiProperty({ example: 5 })
  payments: number;
}

export class DashboardContractsEntity {
  @ApiProperty({ example: 7 })
  active: number;

  @ApiProperty({ example: 8 })
  locals: number;
}

export class DashboardDueGroupEntity {
  @ApiProperty({ example: 5 })
  count: number;

  @ApiProperty({ example: 7500000 })
  amount: number;
}

export class DashboardCurrentDuesEntity {
  @ApiProperty({ type: () => DashboardDueGroupEntity })
  paid: DashboardDueGroupEntity;

  @ApiProperty({ type: () => DashboardDueGroupEntity })
  pending: DashboardDueGroupEntity;
}

export class DashboardMonthEntity {
  @ApiProperty({
    description: '1er du mois à 00:00:00 UTC',
    example: '2026-10-01T00:00:00.000Z',
  })
  month: Date;

  @ApiProperty({ example: 9000000 })
  amount: number;
}

export class DashboardLateLocalEntity {
  @ApiProperty({ example: 'B2' })
  code: string;

  @ApiProperty({ example: 'Boutique B2' })
  name: string;
}

export class DashboardLateTenantEntity {
  @ApiProperty({ example: 'Fatoumata Sylla' })
  name: string;
}

export class DashboardLateContractEntity {
  @ApiProperty({ example: 2 })
  contractId: number;

  @ApiProperty({ type: () => DashboardLateLocalEntity })
  local: DashboardLateLocalEntity;

  @ApiProperty({ type: () => DashboardLateTenantEntity })
  tenant: DashboardLateTenantEntity;

  @ApiProperty({
    description: 'Mois en retard, du plus ancien au plus récent',
    type: [Date],
    example: ['2026-08-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'],
  })
  months: Date[];

  @ApiProperty({ example: 2400000 })
  amount: number;
}

export class DashboardLateEntity {
  @ApiProperty({ description: "Nombre d'échéances LATE", example: 4 })
  count: number;

  @ApiProperty({ example: 4700000 })
  amount: number;
}

export class DashboardEntity {
  @ApiProperty({
    description: 'Mois en cours : 1er du mois à 00:00:00 UTC',
    example: '2026-10-01T00:00:00.000Z',
  })
  month: Date;

  @ApiProperty({
    description: 'Date limite des échéances du mois en cours',
    example: '2026-11-05T00:00:00.000Z',
  })
  dueDate: Date;

  @ApiProperty({ type: () => DashboardCollectedEntity })
  collected: DashboardCollectedEntity;

  @ApiProperty({ type: () => DashboardContractsEntity })
  contracts: DashboardContractsEntity;

  @ApiProperty({ type: () => DashboardCurrentDuesEntity })
  currentDues: DashboardCurrentDuesEntity;

  @ApiProperty({
    description:
      "Part payée des échéances du mois en cours (entier 0-100), null s'il n'y en a pas",
    type: Number,
    nullable: true,
    example: 73,
  })
  recoveryRate: number | null;

  @ApiProperty({
    description:
      'Encaissé sur les six derniers mois, du plus ancien au mois en cours',
    type: () => [DashboardMonthEntity],
  })
  monthly: DashboardMonthEntity[];

  @ApiProperty({ type: () => DashboardLateEntity })
  late: DashboardLateEntity;
}
