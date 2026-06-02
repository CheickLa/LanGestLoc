import { ApiProperty } from '@nestjs/swagger';

export class MessageEntity {
  @ApiProperty({ example: 'Mot de passe mis à jour' })
  message: string;
}
