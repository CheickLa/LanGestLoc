import { Controller, Get, Post, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard, RolesGuard } from '@/auth/guards';
import { CurrentUser } from '@/auth/decorators';

@ApiTags('Paiements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer un paiement (un ou plusieurs mois)' })
  @ApiResponse({ status: 201, description: 'Paiement enregistré' })
  @ApiResponse({ status: 400, description: 'Données invalides ou contrat annulé' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Échéances ou contrat non trouvés' })
  @ApiResponse({ status: 409, description: 'Échéances déjà soldées' })
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: { id: number }) {
    return this.paymentsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les paiements' })
  @ApiResponse({ status: 200, description: 'Liste paginée des paiements' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  findAll(@Query() pagination: PaginationDto) {
    return this.paymentsService.findAll(pagination);
  }

  @Get('contract/:contractId')
  @ApiOperation({ summary: 'Lister les paiements d\'un contrat' })
  @ApiResponse({ status: 200, description: 'Liste des paiements du contrat' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  findAllByContract(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.paymentsService.findAllByContract(contractId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un paiement' })
  @ApiResponse({ status: 200, description: 'Détail du paiement' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Paiement non trouvé' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.findOne(id);
  }
}
