import { IsInt, IsNotEmpty, IsString, Matches, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRentDueDto {
  @ApiProperty({ example: 1, description: 'ID du contrat concerné' })
  @IsInt({ message: "L'identifiant du contrat doit être un entier" })
  @Min(1)
  @IsNotEmpty({ message: 'Le contrat est requis' })
  contractId: number;

  @ApiProperty({
    example: '2026-01',
    description: "Mois de l'échéance (format YYYY-MM)",
  })
  @IsString()
  @IsNotEmpty({ message: 'Le mois est requis' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Format attendu : YYYY-MM (ex: 2026-01)',
  })
  month: string;
}
