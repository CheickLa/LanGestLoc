import { IsDateString, IsEnum, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@generated/prisma/client';

export class TerminateContractDto {
  @ApiProperty({ example: '2026-12-31' })
  @IsDateString(
    {},
    { message: 'La date de fin doit être au format ISO (YYYY-MM-DD)' },
  )
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format attendu : YYYY-MM-DD (ex: 2026-12-31)',
  })
  @IsNotEmpty({ message: 'La date de fin est requise' })
  endDate: string;

  @ApiProperty({
    example: '2026-12-31',
    description: 'Date de restitution de la caution',
  })
  @IsDateString(
    {},
    { message: 'La date de paiement doit être au format ISO (YYYY-MM-DD)' },
  )
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format attendu : YYYY-MM-DD (ex: 2026-12-31)',
  })
  @IsNotEmpty({ message: 'La date de paiement est requise' })
  paymentDate: string;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
    description: 'Moyen de remboursement de la caution',
  })
  @IsEnum(PaymentMethod, { message: 'Le moyen de paiement est invalide' })
  @IsNotEmpty({ message: 'Le moyen de paiement est requis' })
  paymentMethod: PaymentMethod;
}
