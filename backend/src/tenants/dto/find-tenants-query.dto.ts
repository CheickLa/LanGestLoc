import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class FindTenantsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Recherche par nom, téléphone, pièce ou activité (insensible à la casse)',
    example: 'Aminata',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
