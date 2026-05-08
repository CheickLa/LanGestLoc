import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateRentDueDto } from './dto/create-rent-due.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { ContractStatus, RentDueStatus } from '@generated/prisma/client';

@Injectable()
export class RentDueService {
  private readonly logger = new Logger(RentDueService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Génère une échéance pour un contrat et un mois donnés, en utilisant le loyer actif à ce moment-là
  async generate(dto: CreateRentDueDto) {
    const { contractId, month } = dto;
    const EcheanceDay = 5; // Jour de l'échéance : 5 du mois suivant

    const [year, monthIndex] = month.split('-').map(Number);
    const monthDate = new Date(Date.UTC(year, monthIndex - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));

    // dueDate = 5 du mois suivant
    const dueDate = new Date(Date.UTC(year, monthIndex, EcheanceDay));

    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Contrat #${contractId} non trouvé`);
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new ConflictException(`Le contrat #${contractId} n'est pas actif`);
    }

    const existing = await this.prisma.rentDue.findUnique({
      where: { contractId_month: { contractId, month: monthDate } },
    });
    if (existing) {
      throw new ConflictException(`Une échéance existe déjà pour le contrat #${contractId} sur ${month}`);
    }

    // Cherche un loyer actif à n'importe quel moment du mois (pas seulement au 1er)
    const activeRent = await this.prisma.rent.findFirst({
      where: {
        contractId,
        effectiveFrom: { lte: endOfMonth },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!activeRent) {
      throw new NotFoundException(`Aucun loyer actif trouvé pour le contrat #${contractId} sur ${month}`);
    }

    return this.prisma.rentDue.create({
      data: {
        contractId,
        rentId: activeRent.id,
        month: monthDate,
        amount: activeRent.amount,
        dueDate,
      },
    });
  }

  // Liste toutes les échéances d'un contrat, triées par mois décroissant
  async findAllByContract(contractId: number) {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Contrat #${contractId} non trouvé`);

    return this.prisma.rentDue.findMany({
      where: { contractId },
      orderBy: { month: 'desc' },
    });
  }

  // Liste les échéances d'un contrat filtrées par statut
  async findByContract(contractId: number, status: RentDueStatus) {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Contrat #${contractId} non trouvé`);

    return this.prisma.rentDue.findMany({
      where: { contractId, status },
      orderBy: { month: 'desc' },
    });
  }

  // Cron : 1er du mois à 01:00 UTC qui génère les échéances pour tous les contrats ACTIFS
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async generateForAllActiveContracts() {
    this.logger.log('Cron génération RentDue: démarrage');

    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const activeContracts = await this.prisma.contract.findMany({
      where: { status: ContractStatus.ACTIVE },
      select: { id: true },
    });

    let created = 0;
    let skipped = 0;

    for (const contract of activeContracts) {
      try {
        await this.generate({ contractId: contract.id, month });
        created++;
      } catch (e) {
        if (e instanceof ConflictException) {
          skipped++;
        } else {
          this.logger.error(`Cron génération RentDue erreur contrat #${contract.id} : ${e instanceof Error ? e.message : String(e)}`);
          skipped++;
        }
      }
    }

    this.logger.log(`Cron génération RentDue terminé : ${created} créées, ${skipped} ignorées`);
  }

  // Cron : chaque nuit à 00:00 UTC qui fait passer en LATE les échéances PENDING échues
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async markOverdueAsLate() {
    const now = new Date();
    const result = await this.prisma.rentDue.updateMany({
      where: {
        status: RentDueStatus.PENDING,
        dueDate: { lt: now },
      },
      data: { status: RentDueStatus.LATE },
    });

    if (result.count > 0) {
      this.logger.log(`Cron LATE : ${result.count} échéance(s) passée(s) en LATE`);
    }
  }
}
