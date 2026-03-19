import { IsDateString, IsEnum, IsNotEmpty, IsString, Matches, ValidateIf } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export enum DepositAction {
    USED = "USED",
    REFUNDED = "REFUNDED",
}

export class TerminateContractDto {
    @ApiProperty({ example: "2026-12-31" })
    @IsDateString({}, { message: "La date de fin doit être au format ISO (YYYY-MM-DD)" })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Format attendu : YYYY-MM-DD (ex: 2026-12-31)" })
    @IsNotEmpty({ message: "La date de fin est requise" })
    endDate: string;

    @ApiProperty({ enum: DepositAction, example: DepositAction.REFUNDED })
    @IsEnum(DepositAction, { message: "depositAction doit être USED ou REFUNDED" })
    @IsNotEmpty({ message: "Le traitement de la caution est requis" })
    depositAction: DepositAction;

    @ApiProperty({ example: "Utilisée pour solder le loyer dernier mois de location", required: false })
    @ValidateIf(o => o.depositAction === DepositAction.USED)
    @IsString({ message: "La note d'utilisation doit être une chaîne de caractères" })
    @IsNotEmpty({ message: "La note d'utilisation est requise quand la caution est utilisée" })
    usageNote?: string;
}
