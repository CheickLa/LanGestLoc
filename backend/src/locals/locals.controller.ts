import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@generated/prisma/client';
import { LocalsService } from './locals.service';
import { CreateLocalDto } from './dto/create-local.dto';
import { UpdateLocalDto } from './dto/update-local.dto';
import { JwtAuthGuard, RolesGuard } from '@/auth/guards';
import { Roles } from '@/auth/decorators';

@ApiTags('Locaux')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('locals')
export class LocalsController {
  constructor(private readonly localsService: LocalsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Créer un local (ADMIN)' })
  @ApiResponse({ status: 201, description: 'Local créé avec succès' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 409, description: 'Un local avec ce code existe déjà' })
  create(@Body() createLocalDto: CreateLocalDto) {
    return this.localsService.create(createLocalDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les locaux' })
  @ApiResponse({ status: 200, description: 'Liste des locaux' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  findAll() {
    return this.localsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un local par son ID' })
  @ApiResponse({ status: 200, description: 'Local trouvé' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Local non trouvé' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.localsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un local (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Local mis à jour' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Local non trouvé' })
  @ApiResponse({ status: 409, description: 'Un local avec ce code existe déjà' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLocalDto: UpdateLocalDto,
  ) {
    return this.localsService.update(id, updateLocalDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer un local (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Local supprimé' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Local non trouvé' })
  @ApiResponse({ status: 409, description: 'Impossible, des contrats ont été associés à ce local' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.localsService.remove(id);
  }
}