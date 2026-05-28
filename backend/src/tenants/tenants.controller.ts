import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@generated/prisma/client';
import { TenantsService } from './tenants.service';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard, RolesGuard } from '@/auth/guards';
import { Roles } from '@/auth/decorators';

@ApiTags('Locataires')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Créer un nouveau locataire (ADMIN)' })
  @ApiResponse({ status: 201, description: 'Le locataire a été créé avec succès.' })
  @ApiResponse({ status: 400, description: 'Requête invalide (ex: date de naissance dans le futur).' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 409, description: "Conflit (ex: numéro d'identité ou téléphone déjà utilisé)." })
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les locataires' })
  @ApiResponse({ status: 200, description: 'Retourne la liste paginée des locataires.' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  findAll(@Query() pagination: PaginationDto) {
    return this.tenantsService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un locataire par son ID' })
  @ApiResponse({ status: 200, description: "Retourne le locataire correspondant à l'ID spécifié." })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Locataire non trouvé.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un locataire (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Le locataire a été mis à jour avec succès.' })
  @ApiResponse({ status: 400, description: 'Requête invalide (ex: date de naissance dans le futur).' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Locataire non trouvé.' })
  @ApiResponse({ status: 409, description: "Conflit (ex: numéro d'identité ou téléphone déjà utilisé)." })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer un locataire (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Le locataire a été supprimé avec succès.' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Locataire non trouvé.' })
  @ApiResponse({ status: 409, description: 'Conflit (ex: locataire lié à des contrats existants).' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tenantsService.remove(id);
  }
}
