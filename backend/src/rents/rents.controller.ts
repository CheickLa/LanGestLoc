import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { RentsService } from './rents.service';
import { CreateRentDto } from './dto/create-rent.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

@ApiTags('Loyers')
@UseGuards(JwtAuthGuard)
@Controller('rents')
export class RentsController {
  constructor(private readonly rentsService: RentsService) {}

  @Post()
  @ApiOperation({ summary: 'Augmenter le loyer (SCD crée un nouveau Rent, clôture l\'ancien)' })
  @ApiResponse({ status: 201, description: 'Nouveau loyer créé, ancien clôturé' })
  @ApiResponse({ status: 400, description: 'Montant identique, date incohérente ou données invalides' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  @ApiResponse({ status: 409, description: 'Contrat non actif ou aucun loyer actif trouvé' })
  create(@Body() createRentDto: CreateRentDto) {
    return this.rentsService.create(createRentDto);
  }

  @Get('contract/:contractId')
  @ApiOperation({ summary: 'Historique de tous les loyers d\'un contrat' })
  @ApiResponse({ status: 200, description: 'Liste des loyers triés par effectiveFrom' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  findAllByContract(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.rentsService.findAllByContract(contractId);
  }

  @Get('contract/:contractId/current')
  @ApiOperation({ summary: 'Loyer actif actuel d\'un contrat (effectiveTo = null)' })
  @ApiResponse({ status: 200, description: 'Loyer actif trouvé' })
  @ApiResponse({ status: 404, description: 'Aucun loyer actif sur ce contrat' })
  findCurrent(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.rentsService.findCurrent(contractId);
  }
}
