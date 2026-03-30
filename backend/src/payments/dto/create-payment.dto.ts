import { IsArray, IsDateString, IsEnum, IsInt, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@generated/prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ description: 'IDs des échéances à solder (un ou plusieurs mois)', example: [1, 2, 3] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  rentDueIds: number[];

  @ApiProperty({ description: 'Date effective du paiement', example: '2026-03-28' })
  @IsDateString()
  paymentDate: string;

  @ApiProperty({ enum: PaymentMethod, description: 'Moyen de paiement' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
