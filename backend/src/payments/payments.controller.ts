import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPaginatedResponse } from '@/common/decorators/api-paginated-response.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PaymentWithLinesEntity,
  PaymentWithRelationsEntity,
  PaymentDetailEntity,
} from './entities/payment.entity';
import { JwtAuthGuard, RolesGuard } from '@/auth/guards';
import { CurrentUser } from '@/auth/decorators';

@ApiTags('Paiements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer un paiement (un ou plusieurs mois)' })
  @ApiCreatedResponse({
    description: 'Paiement enregistré',
    type: PaymentWithLinesEntity,
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou contrat annulé',
  })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Échéances ou contrat non trouvés' })
  @ApiResponse({ status: 409, description: 'Échéances déjà soldées' })
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: { id: number }) {
    return this.paymentsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les paiements' })
  @ApiPaginatedResponse(PaymentWithRelationsEntity)
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  findAll(@Query() pagination: PaginationDto) {
    return this.paymentsService.findAll(pagination);
  }

  @Get('contract/:contractId')
  @ApiOperation({ summary: "Lister les paiements d'un contrat" })
  @ApiOkResponse({
    description: 'Liste des paiements du contrat',
    type: PaymentWithLinesEntity,
    isArray: true,
  })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  findAllByContract(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.paymentsService.findAllByContract(contractId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un paiement" })
  @ApiOkResponse({
    description: 'Détail du paiement',
    type: PaymentDetailEntity,
  })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Paiement non trouvé' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.findOne(id);
  }
}
