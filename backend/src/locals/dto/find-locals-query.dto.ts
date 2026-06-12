import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class FindLocalsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Recherche par code ou nom (insensible à la casse)',
    example: 'Madina',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
