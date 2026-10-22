import { Injectable } from '@nestjs/common';
import {
  ContractStatus,
  PaymentType,
  RentDueStatus,
} from '@generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { firstOfMonth } from '@/common/months';
import { PaginatedResult, PaginationDto } from '@/common/dto/pagination.dto';
import { dueDateOf } from '@/rent-due/due-date';
import {
  DashboardEntity,
  DashboardLateContractEntity,
  DashboardMonthEntity,
} from './entities/dashboard.entity';

const MONTHS_SHOWN = 6;

interface DueAmount {
  status: RentDueStatus;
  amount: number;
}

interface LateDue {
  month: Date;
  amount: number;
  contract: {
    id: number;
    local: { code: string; name: string };
    tenant: { name: string };
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(now = new Date()): Promise<DashboardEntity> {
    const start = firstOfMonth(now);

    const [payments, activeContracts, locals, currentDues, late] =
      await Promise.all([
        this.prisma.payment.findMany({
          where: {
            type: PaymentType.RENT,
            paymentDate: {
              gte: firstOfMonth(now, 1 - MONTHS_SHOWN),
              lt: firstOfMonth(now, 1),
            },
          },
          select: { amount: true, paymentDate: true },
        }),
        this.prisma.contract.count({
          where: { status: ContractStatus.ACTIVE },
        }),
        this.prisma.local.count(),
        this.prisma.rentDue.findMany({
          where: { month: start },
          select: { status: true, amount: true },
        }),
        this.prisma.rentDue.aggregate({
          where: { status: RentDueStatus.LATE },
          _count: true,
          _sum: { amount: true },
        }),
      ]);

    const monthly = this.collectedByMonth(payments, now);
    const paid = this.sumDues(
      currentDues,
      (d) => d.status === RentDueStatus.PAID,
    );
    const pending = this.sumDues(
      currentDues,
      (d) => d.status !== RentDueStatus.PAID,
    );
    const total = paid.amount + pending.amount;
    const current = monthly[monthly.length - 1];
    const currentPayments = payments.filter(
      (p) => firstOfMonth(p.paymentDate).getTime() === start.getTime(),
    );

    return {
      month: start,
      dueDate: dueDateOf(start),
      collected: { amount: current.amount, payments: currentPayments.length },
      contracts: { active: activeContracts, locals },
      currentDues: { paid, pending },
      recoveryRate:
        total === 0 ? null : Math.floor((100 * paid.amount) / total),
      monthly,
      late: { count: late._count, amount: late._sum.amount ?? 0 },
    };
  }

  async lateContracts({
    skip,
    take,
  }: PaginationDto): Promise<PaginatedResult<DashboardLateContractEntity>> {
    const lateDues = await this.prisma.rentDue.findMany({
      where: { status: RentDueStatus.LATE },
      orderBy: { month: 'asc' },
      select: {
        month: true,
        amount: true,
        contract: {
          select: {
            id: true,
            local: { select: { code: true, name: true } },
            tenant: { select: { name: true } },
          },
        },
      },
    });

    const contracts = this.groupLateByContract(lateDues);
    return {
      items: contracts.slice(skip, skip + take),
      total: contracts.length,
      skip,
      take,
    };
  }

  private collectedByMonth(
    payments: { amount: number; paymentDate: Date }[],
    now: Date,
  ): DashboardMonthEntity[] {
    const months = Array.from({ length: MONTHS_SHOWN }, (_, i) => ({
      month: firstOfMonth(now, i + 1 - MONTHS_SHOWN),
      amount: 0,
    }));
    const byTime = new Map(months.map((m) => [m.month.getTime(), m]));
    for (const payment of payments) {
      const bucket = byTime.get(firstOfMonth(payment.paymentDate).getTime());
      if (bucket) bucket.amount += payment.amount;
    }
    return months;
  }

  private sumDues(dues: DueAmount[], keep: (due: DueAmount) => boolean) {
    const kept = dues.filter(keep);
    return {
      count: kept.length,
      amount: kept.reduce((sum, d) => sum + d.amount, 0),
    };
  }

  private groupLateByContract(dues: LateDue[]): DashboardLateContractEntity[] {
    const byContract = new Map<number, DashboardLateContractEntity>();
    for (const due of dues) {
      const { id, local, tenant } = due.contract;
      const entry = byContract.get(id) ?? {
        contractId: id,
        local: { code: local.code, name: local.name },
        tenant: { name: tenant.name },
        months: [],
        amount: 0,
      };
      entry.months.push(due.month);
      entry.amount += due.amount;
      byContract.set(id, entry);
    }
    return [...byContract.values()].sort(
      (a, b) =>
        a.months[0].getTime() - b.months[0].getTime() ||
        a.local.code.localeCompare(b.local.code),
    );
  }
}
