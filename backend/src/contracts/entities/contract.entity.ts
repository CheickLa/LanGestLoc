import { ApiProperty } from '@nestjs/swagger';
import { ContractStatus } from '@generated/prisma/client';
import { LocalEntity } from '@/locals/entities/local.entity';
import { TenantEntity } from '@/tenants/entities/tenant.entity';
import { RentEntity } from '@/rents/entities/rent.entity';
import { DepositEntity } from './deposit.entity';

/** Champs scalaires d'un contrat (modèle Prisma Contract). */
export class ContractEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  localId: number;

  @ApiProperty({ example: 1 })
  tenantId: number;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  startDate: Date;

  @ApiProperty({ example: '2027-01-01T00:00:00.000Z', nullable: true })
  endDate: Date | null;

  @ApiProperty({ enum: ContractStatus, example: ContractStatus.ACTIVE })
  status: ContractStatus;

  @ApiProperty({ example: 1 })
  createdById: number;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  updatedAt: Date;
}

/** Contrat + local + locataire (base des réponses enrichies). */
export class ContractWithPartiesEntity extends ContractEntity {
  @ApiProperty({ type: () => LocalEntity })
  local: LocalEntity;

  @ApiProperty({ type: () => TenantEntity })
  tenant: TenantEntity;
}

/** Élément de la liste paginée GET /contracts : + loyer actif. */
export class ContractListItemEntity extends ContractWithPartiesEntity {
  @ApiProperty({ type: () => RentEntity, nullable: true })
  activeRent: RentEntity | null;
}

/** Détail GET /contracts/:id (et résiliation) : + historique des loyers, caution, loyer actif. */
export class ContractDetailEntity extends ContractWithPartiesEntity {
  @ApiProperty({ type: () => [RentEntity] })
  rents: RentEntity[];

  @ApiProperty({ type: () => DepositEntity, nullable: true })
  deposit: DepositEntity | null;

  @ApiProperty({ type: () => RentEntity, nullable: true })
  activeRent: RentEntity | null;
}
