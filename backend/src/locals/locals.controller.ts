import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Role } from '@generated/prisma/client';
import { LocalsService } from './locals.service';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPaginatedResponse } from '@/common/decorators/api-paginated-response.decorator';
import { CreateLocalDto } from './dto/create-local.dto';
import { UpdateLocalDto } from './dto/update-local.dto';
import { LocalEntity } from './entities/local.entity';
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
  @ApiCreatedResponse({ description: 'Local créé avec succès', type: LocalEntity })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 409, description: 'Un local avec ce code existe déjà' })
  create(@Body() createLocalDto: CreateLocalDto) {
    return this.localsService.create(createLocalDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les locaux' })
  @ApiPaginatedResponse(LocalEntity)
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  findAll(@Query() pagination: PaginationDto) {
    return this.localsService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un local par son ID' })
  @ApiOkResponse({ description: 'Local trouvé', type: LocalEntity })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Local non trouvé' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.localsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un local (ADMIN)' })
  @ApiOkResponse({ description: 'Local mis à jour', type: LocalEntity })
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
  @ApiOkResponse({ description: 'Local supprimé', type: LocalEntity })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Local non trouvé' })
  @ApiResponse({ status: 409, description: 'Impossible, des contrats ont été associés à ce local' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.localsService.remove(id);
  }
}