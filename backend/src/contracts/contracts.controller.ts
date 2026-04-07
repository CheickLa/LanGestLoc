import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@generated/prisma/client';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { TerminateContractDto } from './dto/terminate-contract.dto';
import { JwtAuthGuard, RolesGuard } from '@/auth/guards';
import { CurrentUser, Roles } from '@/auth/decorators';
import { AuthenticatedUser } from '@/auth/strategies/jwt.strategy';

@ApiTags('Contrats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Créer un contrat de location (ADMIN)' })
  @ApiResponse({ status: 201, description: 'Contrat créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Local ou locataire non trouvé' })
  @ApiResponse({ status: 409, description: 'Le local a déjà un contrat actif' })
  create(@Body() createContractDto: CreateContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contractsService.create(createContractDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les contrats' })
  @ApiResponse({ status: 200, description: 'Liste des contrats' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  findAll() {
    return this.contractsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un contrat par son ID' })
  @ApiResponse({ status: 200, description: 'Contrat trouvé' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.findOne(id);
  }

  @Patch(':id/terminate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Résilier un contrat (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Contrat résilié avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  @ApiResponse({ status: 409, description: "Le contrat n'est pas actif" })
  terminate(
    @Param('id', ParseIntPipe) id: number,
    @Body() terminateContractDto: TerminateContractDto,
  ) {
    return this.contractsService.terminate(id, terminateContractDto);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Annuler un contrat (ADMIN, uniquement si aucun paiement n'existe)" })
  @ApiResponse({ status: 200, description: 'Contrat annulé avec succès' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  @ApiResponse({ status: 409, description: "Impossible d'annuler : des paiements existent ou le contrat n'est pas actif" })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.cancel(id);
  }
}
