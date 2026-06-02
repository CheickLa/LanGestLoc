import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Role, RentDueStatus } from '@generated/prisma/client';
import { RentDueService } from './rent-due.service';
import { CreateRentDueDto } from './dto/create-rent-due.dto';
import { RentDueEntity } from './entities/rent-due.entity';
import { JwtAuthGuard, RolesGuard } from '@/auth/guards';
import { Roles } from '@/auth/decorators';

@ApiTags('Échéances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rent-dues')
export class RentDueController {
  constructor(private readonly rentDueService: RentDueService) {}

  @Post('generate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Générer manuellement une échéance pour un contrat et un mois donnés' })
  @ApiCreatedResponse({ description: 'Échéance créée', type: RentDueEntity })
  @ApiResponse({ status: 400, description: 'Données invalides (format du mois incorrect, etc.)' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé ou aucun loyer actif' })
  @ApiResponse({ status: 409, description: 'Contrat non actif ou échéance déjà existante pour ce mois' })
  generate(@Body() dto: CreateRentDueDto) {
    return this.rentDueService.generate(dto);
  }

  @Get('contract/:contractId')
  @ApiOperation({ summary: 'Lister toutes les échéances d\'un contrat' })
  @ApiOkResponse({ description: 'Liste des échéances triées par mois décroissant', type: RentDueEntity, isArray: true })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  findAllByContract(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.rentDueService.findAllByContract(contractId);
  }

  @Get('contract/:contractId/pending')
  @ApiOperation({ summary: 'Lister les échéances PENDING d\'un contrat' })
  @ApiOkResponse({ description: 'Liste des échéances en attente de paiement', type: RentDueEntity, isArray: true })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  findPendingByContract(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.rentDueService.findByContract(contractId, RentDueStatus.PENDING);
  }

  @Post('cron/generate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[DEV] Déclenche manuellement le cron de génération des échéances' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  triggerGenerate() {
    return this.rentDueService.generateForAllActiveContracts();
  }

  @Post('cron/mark-late')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[DEV] Déclenche manuellement le cron de passage en LATE' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  triggerMarkLate() {
    return this.rentDueService.markOverdueAsLate();
  }
}
