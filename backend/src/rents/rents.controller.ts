import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Role } from '@generated/prisma/client';
import { RentsService } from './rents.service';
import { CreateRentDto } from './dto/create-rent.dto';
import { RentEntity } from './entities/rent.entity';
import { JwtAuthGuard, RolesGuard } from '@/auth/guards';
import { Roles } from '@/auth/decorators';

@ApiTags('Loyers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rents')
export class RentsController {
  constructor(private readonly rentsService: RentsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Augmenter le loyer (ADMIN, SCD crée un nouveau Rent, clôture l\'ancien)' })
  @ApiCreatedResponse({ description: 'Nouveau loyer créé, ancien clôturé', type: RentEntity })
  @ApiResponse({ status: 400, description: 'Montant identique, date incohérente ou données invalides' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  @ApiResponse({ status: 409, description: 'Contrat non actif ou aucun loyer actif trouvé' })
  create(@Body() createRentDto: CreateRentDto) {
    return this.rentsService.create(createRentDto);
  }

  @Get('contract/:contractId')
  @ApiOperation({ summary: 'Historique de tous les loyers d\'un contrat' })
  @ApiOkResponse({ description: 'Liste des loyers triés par effectiveFrom', type: RentEntity, isArray: true })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  findAllByContract(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.rentsService.findAllByContract(contractId);
  }

  @Get('contract/:contractId/current')
  @ApiOperation({ summary: 'Loyer actif actuel d\'un contrat (effectiveTo = null)' })
  @ApiOkResponse({ description: 'Loyer actif trouvé', type: RentEntity })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Aucun loyer actif sur ce contrat' })
  findCurrent(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.rentsService.findCurrent(contractId);
  }
}
