import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ReceiptsService } from '@/receipts/receipts.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  ContractStatus,
  DepositStatus,
  PaymentMethod,
  PaymentType,
  Prisma,
  RentDueStatus,
} from '@generated/prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptsService: ReceiptsService,
  ) {}

  async create(dto: CreatePaymentDto, userId: number) {
    const { rentDueIds, paymentDate, paymentMethod } = dto;

    const uniqueIds = [...new Set(rentDueIds)];

    // les RentDue ciblées
    const rentDues = await this.prisma.rentDue.findMany({
      where: { id: { in: uniqueIds } },
    });

    // Vérf que toutes les IDs existent
    if (rentDues.length !== uniqueIds.length) {
      const foundIds = rentDues.map((r) => r.id);
      const missing = uniqueIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(`Échéances introuvables : ${missing.join(', ')}`);
    }

    // Vérif que toutes appartiennent au même contrat
    const contractIds = [...new Set(rentDues.map((r) => r.contractId))];
    if (contractIds.length > 1) {
      throw new BadRequestException('Toutes les échéances doivent appartenir au même contrat');
    }
    const contractId = contractIds[0];

    // Vérif que le contrat est ACTIVE (pas de paiement sur TERMINATED ou CANCELED)
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Contrat #${contractId} non trouvé`);
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException(
        `Impossible de payer sur un contrat ${contract.status.toLowerCase()}`,
      );
    }

    // Vérif que toutes les RentDue sont PENDING ou LATE (pas déjà PAID)
    const alreadyPaid = rentDues.filter((r) => r.status === RentDueStatus.PAID);
    if (alreadyPaid.length > 0) {
      throw new ConflictException(
        `Les échéances suivantes sont déjà soldées : ${alreadyPaid.map((r) => r.id).join(', ')}`,
      );
    }

    const paymentDateObj = new Date(paymentDate);
    if (paymentDateObj.getTime() > Date.now()) {
      throw new BadRequestException('La date de paiement ne peut pas être dans le futur');
    }
    if (paymentDateObj < contract.startDate) {
      throw new BadRequestException(
        'La date de paiement ne peut pas être antérieure au début du contrat',
      );
    }

    // Montant total depuis les RentDue (pas de saisie manuelle)
    const amount = rentDues.reduce((sum, r) => sum + r.amount, 0);

    try {
      const payment = await this.prisma.$transaction(async (tx) => {
        await tx.rentDue.updateMany({
          where: { id: { in: uniqueIds } },
          data: { status: RentDueStatus.PAID },
        });

        return tx.payment.create({
          data: {
            contractId,
            type: PaymentType.RENT,
            amount,
            paymentDate: paymentDateObj,
            paymentMethod,
            createdById: userId,
            paymentLines: {
              create: uniqueIds.map((rentDueId) => ({ rentDueId })),
            },
          },
          include: {
            paymentLines: {
              include: { rentDue: true },
            },
          },
        });
      });

      // Génère le reçu PDF après le commit de la transaction
      // En cas d'échec, le paiement reste valide et le reçu pourra être regénéré
      try {
        await this.receiptsService.generate(payment.id);
      } catch (error) {
        this.logger.error(`Échec génération reçu pour paiement #${payment.id}`, error);
      }

      return payment;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Une ou plusieurs échéances viennent d\'être soldées par un autre paiement',
        );
      }
      throw error;
    }
  }

  /**
   * Crée un Payment de type DEPOSIT_HELD : trace le versement de la caution
   * par le locataire à la création du contrat. Pas de PaymentLine (pas de
   * RentDue associée). Conçu pour être appelé dans une transaction parente
   */
  async createDepositHeld(
    tx: Prisma.TransactionClient,
    params: {
      contractId: number;
      amount: number;
      userId: number;
      paymentDate: Date;
      paymentMethod: PaymentMethod;
    },
  ) {
    const { contractId, amount, userId, paymentDate, paymentMethod } = params;

    return tx.payment.create({
      data: {
        contractId,
        type: PaymentType.DEPOSIT_HELD,
        amount,
        paymentDate,
        paymentMethod,
        createdById: userId,
      },
    });
  }

  /**
   * Crée un Payment de type DEPOSIT_REFUND (restitution de la caution au
   * locataire). Pas de PaymentLine (aucune RentDue associée). Conçu pour être
   * appelé dans une transaction parente.
   */
  async createDepositRefund(
    tx: Prisma.TransactionClient,
    params: {
      contractId: number;
      userId: number;
      paymentDate: Date;
      paymentMethod: PaymentMethod;
    },
  ) {
    const { contractId, userId, paymentDate, paymentMethod } = params;

    const deposit = await tx.deposit.findUnique({ where: { contractId } });
    if (!deposit) throw new NotFoundException('Aucune caution sur ce contrat');
    if (deposit.status !== DepositStatus.HELD) {
      throw new ConflictException('La caution a déjà été traitée');
    }

    const unpaidCount = await tx.rentDue.count({
      where: {
        contractId,
        status: { in: [RentDueStatus.PENDING, RentDueStatus.LATE] },
      },
    });
    if (unpaidCount > 0) {
      throw new ConflictException(
        `Impossible de rembourser la caution : ${unpaidCount} échéance(s) impayée(s) sur le contrat`,
      );
    }

    const payment = await tx.payment.create({
      data: {
        contractId,
        type: PaymentType.DEPOSIT_REFUND,
        amount: deposit.amount,
        paymentDate,
        paymentMethod,
        createdById: userId,
      },
    });

    await tx.deposit.update({
      where: { contractId },
      data: { status: DepositStatus.REFUNDED, refundedAt: paymentDate },
    });

    return payment;
  }

  /**
   * Déclenche la génération du reçu PDF après commit d'une transaction
   * parente. Les erreurs sont loguées mais n'échouent pas : le reçu pourra
   * être regénéré manuellement
   */
  async generateReceiptSafe(paymentId: number) {
    try {
      await this.receiptsService.generate(paymentId);
    } catch (error) {
      this.logger.error(`Échec génération reçu pour paiement #${paymentId}`, error);
    }
  }

  async findAll() {
    return this.prisma.payment.findMany({
      include: {
        paymentLines: { include: { rentDue: true } },
        contract: { include: { tenant: true, local: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async findAllByContract(contractId: number) {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Contrat #${contractId} non trouvé`);

    return this.prisma.payment.findMany({
      where: { contractId },
      include: {
        paymentLines: { include: { rentDue: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async findOne(id: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        paymentLines: { include: { rentDue: true } },
        contract: { include: { tenant: true, local: true } },
        receipt: true,
      },
    });
    if (!payment) throw new NotFoundException(`Paiement #${id} non trouvé`);
    return payment;
  }
}
