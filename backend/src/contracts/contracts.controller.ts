import { Controller, Get, Post, Patch, Body, Param, Query, ParseIntPipe, UseGuards, Res } from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiProduces,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Role } from '@generated/prisma/client';
import { ContractsService } from './contracts.service';
import { ContractDocumentsService } from './contract-documents.service';
import { ApiPaginatedResponse } from '@/common/decorators/api-paginated-response.decorator';
import { CreateContractDto } from './dto/create-contract.dto';
import { FindContractsQueryDto } from './dto/find-contracts-query.dto';
import { TerminateContractDto } from './dto/terminate-contract.dto';
import { CancelContractDto } from './dto/cancel-contract.dto';
import {
  ContractEntity,
  ContractListItemEntity,
  ContractDetailEntity,
} from './entities/contract.entity';
import { JwtAuthGuard, RolesGuard } from '@/auth/guards';
import { CurrentUser, Roles } from '@/auth/decorators';
import { AuthenticatedUser } from '@/auth/strategies/jwt.strategy';

@ApiTags('Contrats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly contractDocumentsService: ContractDocumentsService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Créer un contrat de location (ADMIN)' })
  @ApiCreatedResponse({ description: 'Contrat créé avec succès', type: ContractEntity })
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
  @ApiPaginatedResponse(ContractListItemEntity)
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  findAll(@Query() query: FindContractsQueryDto) {
    return this.contractsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un contrat par son ID' })
  @ApiOkResponse({ description: 'Contrat trouvé', type: ContractDetailEntity })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.findOne(id);
  }

  @Get(':id/document/download')
  @ApiOperation({ summary: 'Télécharger le contrat de bail (PDF)' })
  @ApiParam({ name: 'id', description: 'ID du contrat', type: Number })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'Fichier PDF du contrat de bail',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  async downloadDocument(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const { buffer, documentNo } = await this.contractDocumentsService.download(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${documentNo}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Patch(':id/terminate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Résilier un contrat (ADMIN)' })
  @ApiOkResponse({ description: 'Contrat résilié avec succès', type: ContractDetailEntity })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  @ApiResponse({ status: 409, description: "Le contrat n'est pas actif" })
  terminate(
    @Param('id', ParseIntPipe) id: number,
    @Body() terminateContractDto: TerminateContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contractsService.terminate(id, terminateContractDto, user.id);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Annuler un contrat avec remboursement de la caution (ADMIN, uniquement si aucun paiement de loyer n'existe)" })
  @ApiOkResponse({ description: 'Contrat annulé avec succès', type: ContractEntity })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  @ApiResponse({ status: 409, description: "Impossible d'annuler : paiement de loyer existant ou contrat non actif" })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() cancelContractDto: CancelContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contractsService.cancel(id, cancelContractDto, user.id);
  }
}
