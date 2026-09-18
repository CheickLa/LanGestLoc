import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiOkResponse,
  ApiProduces,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ReceiptsService } from './receipts.service';
import { ReceiptEntity } from './entities/receipt.entity';
import { JwtAuthGuard, RolesGuard } from '@/auth/guards';

@ApiTags('Reçus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get('payment/:paymentId')
  @ApiOperation({ summary: "Récupérer le reçu d'un paiement" })
  @ApiParam({ name: 'paymentId', description: 'ID du paiement', type: Number })
  @ApiOkResponse({ description: 'Reçu trouvé', type: ReceiptEntity })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Reçu non trouvé pour ce paiement' })
  findByPayment(@Param('paymentId', ParseIntPipe) paymentId: number) {
    return this.receiptsService.findByPayment(paymentId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Télécharger le PDF du reçu' })
  @ApiParam({ name: 'id', description: 'ID du reçu', type: Number })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'Fichier PDF du reçu',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 404, description: 'Reçu non trouvé' })
  async download(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const { buffer, receiptNo } = await this.receiptsService.download(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${receiptNo}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
