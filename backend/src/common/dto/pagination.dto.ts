import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({
    description: "Nombre d'éléments à ignorer",
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'skip doit être un entier' })
  @Min(0, { message: 'skip doit être supérieur ou égal à 0' })
  skip: number = 0;

  @ApiPropertyOptional({
    description: "Nombre d'éléments à retourner",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'take doit être un entier' })
  @Min(1, { message: 'take doit être supérieur ou égal à 1' })
  @Max(100, { message: 'take doit être inférieur ou égal à 100' })
  take: number = 20;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}
