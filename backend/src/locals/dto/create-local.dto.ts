import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  name: string;
}
