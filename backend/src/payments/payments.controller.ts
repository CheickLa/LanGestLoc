import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer un paiement (un ou plusieurs mois)' })
  create(@Body() dto: CreatePaymentDto, @Request() req: any) {
    return this.paymentsService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les paiements' })
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get('contract/:contractId')
  @ApiOperation({ summary: 'Lister les paiements d\'un contrat' })
  findAllByContract(@Param('contractId', ParseIntPipe) contractId: number) {
    return this.paymentsService.findAllByContract(contractId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un paiement' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.findOne(id);
  }
}
