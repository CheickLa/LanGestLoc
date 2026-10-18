import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod, PaymentType } from '@generated/prisma/client';
import { RentDueEntity } from '@/rent-due/entities/rent-due.entity';
import { ContractWithPartiesEntity } from '@/contracts/entities/contract.entity';
import { ReceiptEntity } from '@/receipts/entities/receipt.entity';

/** Ligne de paiement (jointure PaymentLine) + l'échéance soldée. */
export class PaymentLineEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  paymentId: number;

  @ApiProperty({ example: 1 })
  rentDueId: number;

  @ApiProperty({ type: () => RentDueEntity })
  rentDue: RentDueEntity;
}

/** Champs scalaires d'un paiement (modèle Prisma Payment). */
export class PaymentEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  contractId: number;

  @ApiProperty({ enum: PaymentType, example: PaymentType.RENT })
  type: PaymentType;

  @ApiProperty({ example: 150000 })
  amount: number;

  @ApiProperty({ example: '2026-01-03T00:00:00.000Z' })
  paymentDate: Date;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;

  @ApiProperty({ example: 1 })
  createdById: number;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;
}

/** Réponse de GET /payments/contract/:id : + lignes (avec échéance). */
export class PaymentWithLinesEntity extends PaymentEntity {
  @ApiProperty({ type: () => [PaymentLineEntity] })
  paymentLines: PaymentLineEntity[];
}

/** Élément de la liste paginée GET /payments : + contrat (avec local et locataire). */
export class PaymentWithRelationsEntity extends PaymentWithLinesEntity {
  @ApiProperty({ type: () => ContractWithPartiesEntity })
  contract: ContractWithPartiesEntity;
}

/** Détail GET /payments/:id et réponse de POST /payments : + reçu associé. */
export class PaymentDetailEntity extends PaymentWithRelationsEntity {
  @ApiProperty({ type: () => ReceiptEntity, nullable: true })
  receipt: ReceiptEntity | null;
}
