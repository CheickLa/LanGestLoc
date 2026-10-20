import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Receipt } from '@generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { S3Service } from '@/s3/s3.service';
import { buildReceiptPdf } from './pdf/pdf-builder';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);
  private readonly bailleur: string;
  private readonly lieu: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly config: ConfigService,
  ) {
    this.bailleur = this.config.getOrThrow<string>('BAILLEUR_NAME');
    this.lieu = this.config.getOrThrow<string>('BAILLEUR_LIEU');
  }

  async generate(paymentId: number): Promise<Receipt> {
    const existing = await this.prisma.receipt.findUnique({
      where: { paymentId },
    });
    if (existing) return existing;

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        contract: {
          include: {
            tenant: true,
            local: true,
            document: true,
          },
        },
        paymentLines: {
          include: { rentDue: true },
        },
      },
    });
    if (!payment)
      throw new NotFoundException(`Paiement #${paymentId} non trouvé`);

    // La clé contient l'id du paiement : un numéro en double ne peut pas
    // écraser le PDF d'un autre paiement.
    const buildAndPersist = async (): Promise<Receipt> => {
      const year = new Date().getUTCFullYear();
      const lastReceipt = await this.prisma.receipt.findFirst({
        where: { receiptNo: { startsWith: `REC-${year}-` } },
        orderBy: { receiptNo: 'desc' },
      });
      const seq = lastReceipt
        ? parseInt(lastReceipt.receiptNo.split('-')[2], 10) + 1
        : 1;
      const receiptNo = `REC-${year}-${String(seq).padStart(5, '0')}`;

      const pdfBuffer = await buildReceiptPdf(
        payment,
        receiptNo,
        this.bailleur,
        this.lieu,
      );

      const s3Key = `receipts/${paymentId}/${receiptNo}.pdf`;
      await this.s3.upload(s3Key, pdfBuffer, 'application/pdf');

      return this.prisma.receipt.create({
        data: { paymentId, receiptNo, s3Key },
      });
    };

    try {
      return await buildAndPersist();
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const raced = await this.prisma.receipt.findUnique({
          where: { paymentId },
        });
        if (raced) return raced;

        return await buildAndPersist();
      }
      throw e;
    }
  }

  async findByPayment(paymentId: number) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { paymentId },
    });
    if (!receipt)
      throw new NotFoundException(`Aucun reçu pour le paiement #${paymentId}`);
    return receipt;
  }

  async download(id: number): Promise<{ buffer: Buffer; receiptNo: string }> {
    const receipt = await this.prisma.receipt.findUnique({ where: { id } });
    if (!receipt) throw new NotFoundException(`Reçu #${id} non trouvé`);

    try {
      const buffer = await this.s3.getObject(receipt.s3Key);
      return { buffer, receiptNo: receipt.receiptNo };
    } catch (error) {
      this.logger.error(
        `Impossible de récupérer le fichier S3 : ${receipt.s3Key}`,
        error,
      );
      throw new InternalServerErrorException(
        'Le fichier PDF du reçu est temporairement indisponible',
      );
    }
  }
}
