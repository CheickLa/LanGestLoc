import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RentDueService } from './rent-due.service';
import { CreateRentDueDto } from './dto/create-rent-due.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RentDueStatus } from '@generated/prisma/client';

@ApiTags('Échéances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rent-dues')
export class RentDueController {
  constructor(private readonly rentDueService: RentDueService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Générer manuellement une échéance pour un contrat et un mois donnés' })
  @ApiResponse({ status: 201, description: 'Échéance créée' })
  @ApiResponse({ status: 400, description: 'Données invalides (format du mois incorrect, etc.)' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé ou aucun loyer actif' })
  @ApiResponse({ status: 409, description: 'Contrat non actif ou échéance déjà existante pour ce mois' })
  generate(@Body() dto: CreateRentDueDto) {
    return this.rentDueService.generate(dto);
  }

  @Get('contract/:contractId')
  @ApiOperation({ summary: 'Lister toutes les échéances d\'un contrat' })
  @ApiResponse({ status: 200, description: 'Liste des échéances triées par mois décroissant' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  findAllByContract(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.rentDueService.findAllByContract(contractId);
  }

  @Get('contract/:contractId/pending')
  @ApiOperation({ summary: 'Lister les échéances PENDING d\'un contrat' })
  @ApiResponse({ status: 200, description: 'Liste des échéances en attente de paiement' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  findPendingByContract(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.rentDueService.findByContract(contractId, RentDueStatus.PENDING);
  }

  @Post('cron/generate')
  @ApiOperation({ summary: '[DEV] Déclenche manuellement le cron de génération des échéances' })
  triggerGenerate() {
    return this.rentDueService.generateForAllActiveContracts();
  }

  @Post('cron/mark-late')
  @ApiOperation({ summary: '[DEV] Déclenche manuellement le cron de passage en LATE' })
  triggerMarkLate() {
    return this.rentDueService.markOverdueAsLate();
  }
}
