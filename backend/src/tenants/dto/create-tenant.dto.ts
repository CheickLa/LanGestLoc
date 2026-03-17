import { IsNotEmpty, IsOptional, IsString, IsDateString, MinLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateTenantDto {
    @ApiProperty({ example: "Aminata Barry" })
    @IsString({ message: "Le nom doit être une chaîne de caractères" })
    @IsNotEmpty({ message: "Le nom est requis" })
    @MinLength(2, { message: "Le nom doit contenir au moins 2 caractères" })
    name: string;

    @ApiProperty({ example: "Commerçant", required: false })
    @IsString({ message: "L'activité doit être une chaîne de caractères" })
    @IsOptional()
    @MinLength(2, { message: "L'activité doit contenir au moins 2 caractères" })
    activity?: string;

    @ApiProperty({ example: "+224612345678" })
    @IsString({ message: "Le téléphone doit être une chaîne de caractères" })
    @IsNotEmpty({ message: "Le numéro de téléphone est requis" })
    phone: string;

    @ApiProperty({ example: "1990-05-15" })
    @IsDateString({}, { message: "La date de naissance doit être au format ISO (YYYY-MM-DD)" })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Format attendu : YYYY-MM-DD (ex: 2026-05-15)" })
    @IsNotEmpty({ message: "La date de naissance est requise" })
    dateOfBirth: string;

    @ApiProperty({ example: "234567890" })
    @IsString()
    @IsNotEmpty({ message: "Le numéro d'identité est requis" })
    @MinLength(5, { message: "Le numéro d'identité doit contenir au moins 5 caractères" })
    idNumber: string;
}