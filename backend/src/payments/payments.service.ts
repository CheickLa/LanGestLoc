import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ContractStatus, PaymentType, RentDueStatus } from '@generated/prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

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

    // Vérif que le contrat n'est pas CANCELED
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Contrat #${contractId} non trouvé`);
    if (contract.status === ContractStatus.CANCELED) {
      throw new BadRequestException('Impossible de payer sur un contrat annulé');
    }

    // Vérif que toutes les RentDue sont PENDING ou LATE (pas déjà PAID)
    const alreadyPaid = rentDues.filter((r) => r.status === RentDueStatus.PAID);
    if (alreadyPaid.length > 0) {
      throw new ConflictException(
        `Les échéances suivantes sont déjà soldées : ${alreadyPaid.map((r) => r.id).join(', ')}`,
      );
    }

    // Montant total depuis les RentDue (pas de saisie manuelle)
    const amount = rentDues.reduce((sum, r) => sum + r.amount, 0);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.rentDue.updateMany({
          where: { id: { in: uniqueIds } },
          data: { status: RentDueStatus.PAID },
        });

        const payment = await tx.payment.create({
          data: {
            contractId,
            type: PaymentType.RENT,
            amount,
            paymentDate: new Date(paymentDate),
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

        return payment;
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Une ou plusieurs échéances viennent d\'être soldées par un autre paiement',
        );
      }
      throw error;
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
