import { IsDateString, IsEnum, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@generated/prisma/client';

export class CancelContractDto {
  @ApiProperty({
    example: '2026-04-27',
    description: 'Date du remboursement de la caution',
  })
  @IsDateString(
    {},
    {
      message: 'La date de remboursement doit être au format ISO (YYYY-MM-DD)',
    },
  )
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format attendu : YYYY-MM-DD (ex: 2026-04-27)',
  })
  @IsNotEmpty({ message: 'La date de remboursement est requise' })
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
