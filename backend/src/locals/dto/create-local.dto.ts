import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const LOCAL_NAME_MAX_LENGTH = 40;

export class CreateLocalDto {
  @ApiProperty({
    example: 'LOCAL-001',
    pattern: '^LOCAL-\\d{3}$',
    description: 'Format: LOCAL-XXX (3 chiffres)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^LOCAL-\d{3}$/, {
    message: 'Le code doit suivre le format LOCAL-XXX (3 chiffres)',
  })
  code: string;

  @ApiProperty({ example: 'Boutique 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(LOCAL_NAME_MAX_LENGTH, {
    message: `Le nom ne doit pas dépasser ${LOCAL_NAME_MAX_LENGTH} caractères`,
  })
  name: string;
}
