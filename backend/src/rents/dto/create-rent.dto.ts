import { IsInt, IsNotEmpty, IsDateString, Matches, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRentDto {
  @ApiProperty({ example: 1, description: 'ID du contrat concerné' })
  @IsInt({ message: "L'identifiant du contrat doit être un entier" })
  @Min(1)
  @IsNotEmpty({ message: 'Le contrat est requis' })
  contractId: number;

  @ApiProperty({
    example: 1750000,
    description: 'Nouveau montant mensuel du loyer (en GNF)',
  })
  @IsInt({ message: 'Le montant du loyer doit être un entier' })
  @Min(1, { message: 'Le montant du loyer doit être supérieur à 0' })
  @IsNotEmpty({ message: 'Le montant du loyer est requis' })
  amount: number;

  @ApiProperty({
    example: '2026-04-01',
    description: "Date d'entrée en vigueur du nouveau loyer (YYYY-MM-DD)",
  })
  @IsDateString(
    {},
    {
      message:
        "La date d'entrée en vigueur doit être au format ISO (YYYY-MM-DD)",
    },
  )
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Format attendu : YYYY-MM-DD (ex: 2026-04-01)',
  })
  @IsNotEmpty({ message: "La date d'entrée en vigueur est requise" })
  effectiveFrom: string;
}
