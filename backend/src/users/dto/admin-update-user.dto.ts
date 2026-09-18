import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { trim, trimLowercase } from '@/common/transforms';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@generated/prisma/client';

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  name?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @Transform(trimLowercase)
  @IsEmail({}, { message: "L'email doit être valide" })
  email?: string;

  @ApiPropertyOptional({ enum: Role, example: Role.USER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
