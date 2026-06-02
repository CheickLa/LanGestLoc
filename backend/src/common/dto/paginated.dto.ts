import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

export class PaginatedDto<T> {
  @ApiProperty()
  total: number;

  @ApiProperty()
  skip: number;

  @ApiProperty()
  take: number;

  // Le schéma réel de `items` est injecté par ApiPaginatedResponse (allOf).
  // On masque la propriété ici pour empêcher le plugin Swagger CLI d'introspecter
  // le générique `T[]` (ce qui provoque une « circular dependency » sur `items`).
  @ApiHideProperty()
  items: T[];
}
