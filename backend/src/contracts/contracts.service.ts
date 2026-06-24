import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateContractDto } from './dto/create-contract.dto';
import { TerminateContractDto } from './dto/terminate-contract.dto';
import { CancelContractDto } from './dto/cancel-contract.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentsService } from '@/payments/payments.service';
import { ContractDocumentsService } from './contract-documents.service';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { ContractStatus, PaymentType, Prisma, RentDueStatus } from '@generated/prisma/client';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly contractDocumentsService: ContractDocumentsService,
  ) {}

  async create(dto: CreateContractDto, userId: number) {
    const { localId, tenantId, startDate, endDate, rentAmount, depositPaymentMethod, depositPaymentDate } = dto;

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    if (end && end <= start) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début');
    }

    const local = await this.prisma.local.findUnique({ where: { id: localId } });
    if (!local) throw new NotFoundException(`Local #${localId} non trouvé`);

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Locataire #${tenantId} non trouvé`);

    const depositDate = new Date(depositPaymentDate);
    if (depositDate.getTime() > Date.now()) {
      throw new BadRequestException('La date de versement de la caution ne peut pas être dans le futur');
    }

    try {
      const { contract, depositPayment } = await this.prisma.$transaction(async (tx) => {
        const activeContract = await tx.contract.findFirst({
          where: { localId, status: ContractStatus.ACTIVE },
        });
        if (activeContract) {
          throw new ConflictException(`Le local #${localId} a déjà un contrat actif`);
        }

        const contract = await tx.contract.create({
          data: {
            localId,
            tenantId,
            startDate: start,
            endDate: end,
            status: ContractStatus.ACTIVE,
            createdById: userId,
          },
        });

        await tx.rent.create({
          data: {
            contractId: contract.id,
            amount: rentAmount,
            effectiveFrom: start,
          },
        });

        await tx.deposit.create({
          data: {
            contractId: contract.id,
            amount: rentAmount,
          },
        });

        const depositPayment = await this.paymentsService.createDepositHeld(tx, {
          contractId: contract.id,
          amount: rentAmount,
          userId,
          paymentDate: depositDate,
          paymentMethod: depositPaymentMethod,
        });

        return { contract, depositPayment };
      });

      await this.paymentsService.generateReceiptSafe(depositPayment.id);
      await this.contractDocumentsService.generateSafe(contract.id);

      return contract;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Le local #${localId} a déjà un contrat actif`);
      }
      throw error;
    }
  }

  async findAll({ skip, take }: PaginationDto) {
    const [contracts, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        skip,
        take,
        include: {
          local: true,
          tenant: true,
          rents: {
            where: { effectiveTo: null },
          },
        },
      }),
      this.prisma.contract.count(),
    ]);

    const items = contracts.map(({ rents, ...contract }) => ({
      ...contract,
      activeRent: rents[0] ?? null,
    }));

    return { items, total, skip, take };
  }

  async findOne(id: number) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        local: true,
        tenant: true,
        rents: {
          orderBy: { effectiveFrom: 'asc' },
        },
        deposit: true,
        document: true,
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    const activeRent = contract.rents.find((r) => r.effectiveTo === null) ?? null;

    return { ...contract, activeRent };
  }

  async terminate(id: number, dto: TerminateContractDto, userId: number) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { deposit: true },
    });

    if (!contract) throw new NotFoundException(`Contrat #${id} non trouvé`);
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new ConflictException(`Le contrat #${id} n'est pas actif`);
    }
    if (!contract.deposit) {
      throw new ConflictException(`Le contrat #${id} n'a pas de caution à traiter`);
    }

    const endDate = new Date(dto.endDate);
    if (endDate < contract.startDate) {
      throw new BadRequestException(
        'La date de fin doit être postérieure ou égale à la date de début du contrat',
      );
    }
    if (endDate.getTime() > Date.now()) {
      throw new BadRequestException('La date de fin du contrat ne peut pas être dans le futur');
    }

    const paymentDate = new Date(dto.paymentDate);
    if (paymentDate.getTime() > Date.now()) {
      throw new BadRequestException('La date de remboursement ne peut pas être dans le futur');
    }
    if (paymentDate < contract.startDate) {
      throw new BadRequestException(
        'La date de remboursement ne peut pas être antérieure au début du contrat',
      );
    }

    const unpaidUpToEnd = await this.prisma.rentDue.count({
      where: {
        contractId: id,
        month: { lte: endDate },
        status: { in: [RentDueStatus.PENDING, RentDueStatus.LATE] },
      },
    });
    if (unpaidUpToEnd > 0) {
      throw new ConflictException(
        `Impossible de terminer le contrat : ${unpaidUpToEnd} échéance(s) impayée(s) avant la date de fin. Régler les loyers avant la résiliation.`,
      );
    }

    const { depositPayment, result } = await this.prisma.$transaction(async (tx) => {
      await tx.rentDue.deleteMany({
        where: {
          contractId: id,
          month: { gt: endDate },
          status: { in: [RentDueStatus.PENDING, RentDueStatus.LATE] },
        },
      });

      await tx.contract.update({
        where: { id },
        data: {
          status: ContractStatus.TERMINATED,
          endDate,
        },
      });

      const depositPayment = await this.paymentsService.createDepositRefund(tx, {
        contractId: id,
        userId,
        paymentDate,
        paymentMethod: dto.paymentMethod,
      });

      const contract = await tx.contract.findUniqueOrThrow({
        where: { id },
        include: { local: true, tenant: true, rents: true, deposit: true },
      });

      const activeRent = contract.rents.find((r) => r.effectiveTo === null) ?? null;

      return { depositPayment, result: { ...contract, activeRent } };
    });

    await this.paymentsService.generateReceiptSafe(depositPayment.id);

    return result;
  }

  async cancel(id: number, dto: CancelContractDto, userId: number) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { payments: true, deposit: true },
    });

    if (!contract) throw new NotFoundException(`Contrat #${id} non trouvé`);
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new ConflictException(`Le contrat #${id} n'est pas actif`);
    }
    if (!contract.deposit) {
      throw new ConflictException(`Le contrat #${id} n'a pas de caution à rembourser`);
    }

    const rentPayments = contract.payments.filter((p) => p.type === PaymentType.RENT);
    if (rentPayments.length > 0) {
      throw new ConflictException(
        `Impossible d'annuler : des paiements de loyer existent sur ce contrat`,
      );
    }

    const paymentDate = new Date(dto.paymentDate);
    if (paymentDate.getTime() > Date.now()) {
      throw new BadRequestException('La date de remboursement ne peut pas être dans le futur');
    }
    if (paymentDate < contract.startDate) {
      throw new BadRequestException(
        'La date de remboursement ne peut pas être antérieure au début du contrat',
      );
    }

    const { refundPayment, result } = await this.prisma.$transaction(async (tx) => {
      await tx.rentDue.deleteMany({
        where: {
          contractId: id,
          status: { in: [RentDueStatus.PENDING, RentDueStatus.LATE] },
        },
      });

      const refundPayment = await this.paymentsService.createDepositRefund(tx, {
        contractId: id,
        userId,
        paymentDate,
        paymentMethod: dto.paymentMethod,
      });

      const result = await tx.contract.update({
        where: { id },
        data: { status: ContractStatus.CANCELED },
      });

      return { refundPayment, result };
    });

    await this.paymentsService.generateReceiptSafe(refundPayment.id);

    return result;
  }
}
