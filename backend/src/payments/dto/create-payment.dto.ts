import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@generated/prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ example: 1, description: 'ID du contrat à payer' })
  @IsInt()
  @Min(1)
  contractId: number;

  @ApiProperty({
    example: '2026-10',
    description: "Mois jusqu'auquel solder les loyers, inclus (format YYYY-MM)",
  })
  @IsString()
  @IsNotEmpty({ message: 'Le mois est requis' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Format attendu : YYYY-MM (ex: 2026-01)',
  })
  untilMonth: string;

  @ApiProperty({
    example: 4500000,
    description: "Total affiché, comparé par l'API à la somme des mois",
  })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Date effective du paiement',
    example: '2026-03-28',
  })
  @IsDateString()
  paymentDate: string;

  @ApiProperty({ enum: PaymentMethod, description: 'Moyen de paiement' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
