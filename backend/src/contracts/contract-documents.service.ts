import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ContractDocument } from '@generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { S3Service } from '@/s3/s3.service';
import { buildBailPdf, BailData } from './pdf/bail-builder';

@Injectable()
export class ContractDocumentsService {
  private readonly logger = new Logger(ContractDocumentsService.name);
  private readonly bailleur: string;
  private readonly lieu: string;
  private readonly representant?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly config: ConfigService,
  ) {
    this.bailleur = this.config.getOrThrow<string>('BAILLEUR_NAME');
    this.lieu = this.config.getOrThrow<string>('BAILLEUR_LIEU');
    this.representant =
      this.config.get<string>('BAILLEUR_REP')?.trim() || undefined;
  }

  /**
   * Génère ou retourne le contrat de bail PDF d'un contrat. Idempotent :
   * si un document existe déjà, il est renvoyé tel quel (jamais régénéré).
   */
  async generate(contractId: number): Promise<ContractDocument> {
    const existing = await this.prisma.contractDocument.findUnique({
      where: { contractId },
    });
    if (existing) return existing;

    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        tenant: true,
        local: true,
        rents: { orderBy: { effectiveFrom: 'asc' }, take: 1 },
        deposit: true,
      },
    });
    if (!contract)
      throw new NotFoundException(`Contrat #${contractId} non trouvé`);

    const initialRent = contract.rents[0];
    if (!initialRent || !contract.deposit) {
      throw new NotFoundException(
        `Contrat #${contractId} incomplet (loyer ou caution manquant)`,
      );
    }

    const data: BailData = {
      tenant: contract.tenant,
      local: contract.local,
      startDate: contract.startDate,
      endDate: contract.endDate,
      rentAmount: initialRent.amount,
      depositAmount: contract.deposit.amount,
    };

    const buildAndPersist = async (): Promise<ContractDocument> => {
      const year = new Date().getUTCFullYear();
      const last = await this.prisma.contractDocument.findFirst({
        where: { documentNo: { startsWith: `BAIL-${year}-` } },
        orderBy: { documentNo: 'desc' },
      });
      const seq = last ? parseInt(last.documentNo.split('-')[2], 10) + 1 : 1;
      const documentNo = `BAIL-${year}-${String(seq).padStart(5, '0')}`;

      const pdfBuffer = await buildBailPdf(
        data,
        documentNo,
        this.bailleur,
        this.lieu,
        this.representant,
      );

      const s3Key = `contracts/${contractId}/${documentNo}.pdf`;
      await this.s3.upload(s3Key, pdfBuffer, 'application/pdf');

      return this.prisma.contractDocument.create({
        data: { contractId, documentNo, s3Key },
      });
    };

    try {
      return await buildAndPersist();
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const raced = await this.prisma.contractDocument.findUnique({
          where: { contractId },
        });
        if (raced) return raced;

        return await buildAndPersist();
      }
      throw e;
    }
  }

  /**
   * Déclenche la génération du contrat après commit de la création du contrat
   * Les erreurs sont loguées sans faire échouer la création : le bail sera
   * généré paresseusement au premier téléchargement
   */
  async generateSafe(contractId: number): Promise<void> {
    try {
      await this.generate(contractId);
    } catch (error) {
      this.logger.error(
        `Échec génération bail pour contrat #${contractId}`,
        error,
      );
    }
  }

  async download(
    contractId: number,
  ): Promise<{ buffer: Buffer; documentNo: string }> {
    const doc = await this.generate(contractId);

    try {
      const buffer = await this.s3.getObject(doc.s3Key);
      return { buffer, documentNo: doc.documentNo };
    } catch (error) {
      this.logger.error(
        `Impossible de récupérer le fichier S3 : ${doc.s3Key}`,
        error,
      );
      throw new InternalServerErrorException(
        'Le contrat de bail est temporairement indisponible',
      );
    }
  }
}
