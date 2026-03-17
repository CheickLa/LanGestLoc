import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: "Créer un nouveau locataire" })
  @ApiResponse({ status: 201, description: "Le locataire a été créé avec succès." })
  @ApiResponse({ status: 400, description: "Requête invalide (ex: date de naissance dans le futur)." })
  @ApiResponse({ status: 409, description: "Conflit (ex: numéro d'identité ou téléphone déjà utilisé)." })
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto);
  }

  @Get()
  @ApiOperation({ summary: "Récupérer tous les locataires" })
  @ApiResponse({ status: 200, description: "Retourne la liste de tous les locataires." })
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: "Récupérer un locataire par son ID" })
  @ApiResponse({ status: 200, description: "Retourne le locataire correspondant à l'ID spécifié." })
  @ApiResponse({ status: 404, description: "Locataire non trouvé." })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Mettre à jour un locataire" })
  @ApiResponse({ status: 200, description: "Le locataire a été mis à jour avec succès." })
  @ApiResponse({ status: 400, description: "Requête invalide (ex: date de naissance dans le futur)." })
  @ApiResponse({ status: 404, description: "Locataire non trouvé." })
  @ApiResponse({ status: 409, description: "Conflit (ex: numéro d'identité ou téléphone déjà utilisé)." })
  update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantsService.update(+id, updateTenantDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Supprimer un locataire" })
  @ApiResponse({ status: 200, description: "Le locataire a été supprimé avec succès." })
  @ApiResponse({ status: 404, description: "Locataire non trouvé." })
  @ApiResponse({ status: 409, description: "Conflit (ex: locataire lié à des contrats existants)." })
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(+id);
  }
}
