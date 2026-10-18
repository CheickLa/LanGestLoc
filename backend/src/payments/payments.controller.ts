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
import { ApiPaginatedResponse } from '@/common/decorators/api-paginated-response.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FindPaymentsQueryDto } from './dto/find-payments-query.dto';
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
  @ApiOperation({ summary: "Solder les loyers d'un contrat jusqu'à un mois" })
  @ApiCreatedResponse({
    description: 'Paiement enregistré',
    type: PaymentDetailEntity,
  })
  @ApiResponse({
    status: 400,
    description:
      'Données invalides, contrat non actif, date ou mois hors bornes',
  })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Contrat non trouvé' })
  @ApiResponse({
    status: 409,
    description:
      'Mois déjà soldés, montant différent du total, caution non versée, ou mois modifiés entre-temps',
  })
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: { id: number }) {
    return this.paymentsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les paiements' })
  @ApiPaginatedResponse(PaymentWithRelationsEntity)
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  findAll(@Query() query: FindPaymentsQueryDto) {
    return this.paymentsService.findAll(query);
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
