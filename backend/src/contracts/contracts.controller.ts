import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { TerminateContractDto } from './dto/terminate-contract.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators';
import { AuthenticatedUser } from '@/auth/strategies/jwt.strategy';

@ApiTags('Contrats')
@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un contrat de location' })
  @ApiResponse({ status: 201, description: 'Contrat créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 404, description: 'Local ou locataire non trouvé' })
  @ApiResponse({ status: 409, description: 'Le local a déjà un contrat actif' })
  create(@Body() createContractDto: CreateContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contractsService.create(createContractDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les contrats' })
  @ApiResponse({ status: 200, description: 'Liste des contrats' })
  findAll() {
    return this.contractsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un contrat par son ID' })
  @ApiResponse({ status: 200, description: 'Contrat trouvé' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.findOne(id);
  }

  @Patch(':id/terminate')
  @ApiOperation({ summary: 'Résilier un contrat' })
  @ApiResponse({ status: 200, description: 'Contrat résilié avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  @ApiResponse({ status: 409, description: "Le contrat n'est pas actif" })
  terminate(
    @Param('id', ParseIntPipe) id: number,
    @Body() terminateContractDto: TerminateContractDto,
  ) {
    return this.contractsService.terminate(id, terminateContractDto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: "Annuler un contrat (uniquement si aucun paiement n'existe)" })
  @ApiResponse({ status: 200, description: 'Contrat annulé avec succès' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  @ApiResponse({ status: 409, description: "Impossible d'annuler : des paiements existent ou le contrat n'est pas actif" })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.cancel(id);
  }
}
