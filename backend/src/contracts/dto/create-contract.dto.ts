import { IsInt, IsNotEmpty, IsOptional, IsDateString, IsEnum, Matches, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PaymentMethod } from "@generated/prisma/client";

export class CreateContractDto {
    @ApiProperty({ example: 1 })
    @IsInt({ message: "L'identifiant du local doit être un entier" })
    @Min(1)
    @IsNotEmpty({ message: "Le local est requis" })
    localId: number;

    @ApiProperty({ example: 1 })
    @IsInt({ message: "L'identifiant du locataire doit être un entier" })
    @Min(1)
    @IsNotEmpty({ message: "Le locataire est requis" })
    tenantId: number;

    @ApiProperty({ example: "2026-01-01" })
    @IsDateString({}, { message: "La date de début doit être au format ISO (YYYY-MM-DD)" })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Format attendu : YYYY-MM-DD (ex: 2026-01-01)" })
    @IsNotEmpty({ message: "La date de début est requise" })
    startDate: string;

    @ApiProperty({ example: "2027-01-01", required: false })
    @IsDateString({}, { message: "La date de fin doit être au format ISO (YYYY-MM-DD)" })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Format attendu : YYYY-MM-DD (ex: 2027-01-01)" })
    @IsOptional()
    endDate?: string;

    @ApiProperty({ example: 150000, description: "Montant mensuel du loyer initial (en GNF). La caution est automatiquement fixée à ce montant." })
    @IsInt({ message: "Le montant du loyer doit être un entier" })
    @Min(1, { message: "Le montant du loyer doit être supérieur à 0" })
    @IsNotEmpty({ message: "Le montant du loyer est requis" })
    rentAmount: number;

    @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH, description: "Moyen utilisé par le locataire pour verser la caution" })
    @IsEnum(PaymentMethod, { message: "Le moyen de paiement de la caution est invalide" })
    @IsNotEmpty({ message: "Le moyen de paiement de la caution est requis" })
    depositPaymentMethod: PaymentMethod;

    @ApiProperty({ example: "2026-01-01", description: "Date à laquelle la caution a été versée" })
    @IsDateString({}, { message: "La date de versement de la caution doit être au format ISO (YYYY-MM-DD)" })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Format attendu : YYYY-MM-DD (ex: 2026-01-01)" })
    @IsNotEmpty({ message: "La date de versement de la caution est requise" })
    depositPaymentDate: string;
}
