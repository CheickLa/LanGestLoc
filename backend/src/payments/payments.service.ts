import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ReceiptsService } from '@/receipts/receipts.service';
import { firstOfMonth, parseMonth } from '@/common/months';
import { dueDateOf } from '@/rent-due/due-date';
import { MAX_ADVANCE_MONTHS, payableMonths } from '@/rent-due/payable-months';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FindPaymentsQueryDto } from './dto/find-payments-query.dto';
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
    const { contractId, untilMonth, amount, paymentDate, paymentMethod } = dto;

    let paymentId: number;
    try {
      paymentId = await this.prisma.$transaction(async (tx) => {
        // Sérialise avec la résiliation, l'annulation et l'augmentation du contrat
        await tx.$queryRaw`SELECT id FROM "Contract" WHERE id = ${contractId} FOR UPDATE`;
        const contract = await tx.contract.findUnique({
          where: { id: contractId },
          include: {
            rents: true,
            rentDues: true,
            payments: { where: { type: PaymentType.DEPOSIT_HELD } },
          },
        });
        if (!contract)
          throw new NotFoundException(`Contrat #${contractId} non trouvé`);
        if (contract.status !== ContractStatus.ACTIVE) {
          throw new BadRequestException(
            `Impossible de payer sur un contrat ${contract.status.toLowerCase()}`,
          );
        }
        const deposit = contract.payments[0];
        if (!deposit) {
          throw new ConflictException(
            `Le contrat #${contractId} n'a pas de versement de caution`,
          );
        }

        const now = new Date();
        const paymentDateObj = new Date(paymentDate);
        if (paymentDateObj.getTime() > now.getTime()) {
          throw new BadRequestException(
            'La date de paiement ne peut pas être dans le futur',
          );
        }
        if (paymentDateObj < deposit.paymentDate) {
          throw new BadRequestException(
            'La date de paiement ne peut pas être antérieure au versement de la caution',
          );
        }

        const until = parseMonth(untilMonth);
        if (until < firstOfMonth(contract.startDate)) {
          throw new BadRequestException(
            `Le mois ${untilMonth} est avant le début du contrat`,
          );
        }
        if (contract.endDate && until > firstOfMonth(contract.endDate)) {
          throw new BadRequestException(
            `Le mois ${untilMonth} est après la fin du contrat`,
          );
        }
        if (until > firstOfMonth(now, MAX_ADVANCE_MONTHS)) {
          throw new BadRequestException(
            `Le paiement à l'avance est limité à ${MAX_ADVANCE_MONTHS} mois après le mois en cours`,
          );
        }

        const toPay = payableMonths(
          contract,
          contract.rentDues,
          contract.rents,
          now,
        ).filter((m) => m.month <= until);
        if (toPay.length === 0) {
          throw new ConflictException(
            `Les loyers sont déjà soldés jusqu'à ${untilMonth}`,
          );
        }
        const total = toPay.reduce((sum, m) => sum + m.amount, 0);
        if (total !== amount) {
          throw new ConflictException(
            `Le montant (${amount}) ne correspond pas au total des mois à payer (${total})`,
          );
        }

        const toCreate = toPay.filter((m) => m.rentDueId === null);
        const created = toCreate.length
          ? await tx.rentDue.createManyAndReturn({
              data: toCreate.map((m) => ({
                contractId,
                rentId: m.rentId,
                month: m.month,
                amount: m.amount,
                dueDate: dueDateOf(m.month),
                status: RentDueStatus.PAID,
              })),
            })
          : [];
        const createdIdByMonth = new Map(
          created.map((d) => [d.month.getTime(), d.id]),
        );

        const existingIds = toPay
          .map((m) => m.rentDueId)
          .filter((id): id is number => id !== null);
        if (existingIds.length) {
          await tx.rentDue.updateMany({
            where: { id: { in: existingIds } },
            data: { status: RentDueStatus.PAID },
          });
        }

        const payment = await tx.payment.create({
          data: {
            contractId,
            type: PaymentType.RENT,
            amount: total,
            paymentDate: paymentDateObj,
            paymentMethod,
            createdById: userId,
            paymentLines: {
              create: toPay.map((m) => ({
                rentDueId:
                  m.rentDueId ?? createdIdByMonth.get(m.month.getTime())!,
              })),
            },
          },
        });
        return payment.id;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          "Les mois à payer viennent d'être modifiés : recommencer.",
        );
      }
      throw error;
    }

    // Le reçu se génère après le commit ; en cas d'échec il pourra être regénéré
    await this.generateReceiptSafe(paymentId);
    return this.findOne(paymentId);
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
      this.logger.error(
        `Échec génération reçu pour paiement #${paymentId}`,
        error,
      );
    }
  }

  async findAll({ skip, take, search }: FindPaymentsQueryDto) {
    const where: Prisma.PaymentWhereInput = search
      ? {
          contract: {
            OR: [
              { local: { name: { contains: search, mode: 'insensitive' } } },
              { tenant: { name: { contains: search, mode: 'insensitive' } } },
            ],
          },
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        include: {
          paymentLines: { include: { rentDue: true } },
          contract: { include: { tenant: true, local: true } },
        },
        orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async findAllByContract(contractId: number) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!contract)
      throw new NotFoundException(`Contrat #${contractId} non trouvé`);

    return this.prisma.payment.findMany({
      where: { contractId },
      include: {
        paymentLines: { include: { rentDue: true } },
      },
      orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
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
