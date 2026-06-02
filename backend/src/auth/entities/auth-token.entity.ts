import { ApiProperty } from '@nestjs/swagger';

export class AuthTokenEntity {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiInR5cCI6IkpXVCJ9...' })
  accessToken: string;
}
