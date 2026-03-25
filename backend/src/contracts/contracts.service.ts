import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateContractDto } from './dto/create-contract.dto';
import { TerminateContractDto } from './dto/terminate-contract.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { ContractStatus, DepositStatus } from '@generated/prisma/client';
import { DepositAction } from './dto/terminate-contract.dto';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContractDto, userId: number) {
    const { localId, tenantId, startDate, endDate, rentAmount, depositAmount } = dto;

    // Verif si le local existe
    const local = await this.prisma.local.findUnique({ where: { id: localId } });
    if (!local) throw new NotFoundException(`Local #${localId} non trouvé`);

    // Verif si le locataire existe
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Locataire #${tenantId} non trouvé`);

    // Verif si le local n'a pas déjà un contrat actif
    const activeContract = await this.prisma.contract.findFirst({
      where: { localId, status: ContractStatus.ACTIVE },
    });
    if (activeContract) {
      throw new ConflictException(`Le local #${localId} a déjà un contrat actif`);
    }

    const start = new Date(startDate);

    return this.prisma.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          localId,
          tenantId,
          startDate: start,
          endDate: endDate ? new Date(endDate) : null,
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

      if (depositAmount) {
        await tx.deposit.create({
          data: {
            contractId: contract.id,
            amount: depositAmount,
          },
        });
      }

      return contract;
    });
  }

  async findAll() {
    const contracts = await this.prisma.contract.findMany({
      include: {
        local: true,
        tenant: true,
        rents: {
          where: { effectiveTo: null },
        },
      },
    });

    return contracts.map(({ rents, ...contract }) => ({
      ...contract,
      activeRent: rents[0] ?? null,
    }));
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
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    const activeRent = contract.rents.find((r) => r.effectiveTo === null) ?? null;

    return { ...contract, activeRent };
  }

  async terminate(id: number, dto: TerminateContractDto) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { deposit: true },
    });

    if (!contract) throw new NotFoundException(`Contrat #${id} non trouvé`);
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new ConflictException(`Le contrat #${id} n'est pas actif`);
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id },
        data: {
          status: ContractStatus.TERMINATED,
          endDate: new Date(dto.endDate),
        },
      });

      if (contract.deposit) {
        await tx.deposit.update({
          where: { contractId: id },
          data:
            dto.depositAction === DepositAction.USED
              ? { status: DepositStatus.USED, usedAt: now, usageNote: dto.usageNote }
              : { status: DepositStatus.REFUNDED, refundedAt: now },
        });
      }

      return tx.contract.findUnique({
        where: { id },
        include: { local: true, tenant: true, rents: true, deposit: true },
      });
    });
  }

  async cancel(id: number) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!contract) throw new NotFoundException(`Contrat #${id} non trouvé`);
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new ConflictException(`Le contrat #${id} n'est pas actif`);
    }
    if (contract.payments.length > 0) {
      throw new ConflictException(`Impossible d'annuler : des paiements existent sur ce contrat`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (await tx.deposit.findUnique({ where: { contractId: id } })) {
        await tx.deposit.delete({ where: { contractId: id } });
      }

      return tx.contract.update({
        where: { id },
        data: { status: ContractStatus.CANCELED },
      });
    });
  }
}
