import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards';
import { ApiPaginatedResponse } from '@/common/decorators/api-paginated-response.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { DashboardService } from './dashboard.service';
import {
  DashboardEntity,
  DashboardLateContractEntity,
} from './entities/dashboard.entity';

@ApiTags('Tableau de bord')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Chiffres du mois et loyers en retard' })
  @ApiOkResponse({ type: DashboardEntity })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  summary() {
    return this.dashboardService.summary();
  }

  @Get('late-contracts')
  @ApiOperation({ summary: 'Contrats en retard, paginés' })
  @ApiPaginatedResponse(DashboardLateContractEntity)
  @ApiResponse({
    status: 400,
    description: 'Paramètres de pagination invalides',
  })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  lateContracts(@Query() query: PaginationDto) {
    return this.dashboardService.lateContracts(query);
  }
}
