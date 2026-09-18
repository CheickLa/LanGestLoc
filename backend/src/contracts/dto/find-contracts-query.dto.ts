import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class FindContractsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Recherche par nom du local ou du locataire (insensible à la casse)',
    example: 'Centre-ville',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
