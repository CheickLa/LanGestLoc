import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { trim, trimLowercase } from '@/common/transforms';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@generated/prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @Transform(trimLowercase)
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'P@ssw0rd!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: Role, example: Role.USER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
