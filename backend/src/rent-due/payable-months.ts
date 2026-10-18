import type { Rent, RentDue } from '@generated/prisma/client';
import { firstOfMonth, monthsBetween } from '@/common/months';
import { dueDateOf, initialStatusOf } from './due-date';

export const MAX_ADVANCE_MONTHS = 12;

export type PayableStatus = 'LATE' | 'PENDING' | 'ADVANCE';

export interface PayableMonth {
  month: Date;
  amount: number;
  status: PayableStatus;
  rentId: number;
  rentDueId: number | null;
}

export function lastPayableMonth(endDate: Date | null, now: Date): Date {
  const limit = firstOfMonth(now, MAX_ADVANCE_MONTHS);
  if (!endDate) return limit;
  const last = firstOfMonth(endDate);
  return last < limit ? last : limit;
}

type RentInForce = Pick<
  Rent,
  'id' | 'amount' | 'effectiveFrom' | 'effectiveTo'
>;

// Même règle que RentDueService.generate : le plus récent des loyers actifs dans le mois
function rentInForce(
  rents: RentInForce[],
  month: Date,
): RentInForce | undefined {
  const endOfMonth = new Date(firstOfMonth(month, 1).getTime() - 1);
  return rents
    .filter(
      (r) =>
        r.effectiveFrom <= endOfMonth &&
        (r.effectiveTo === null || r.effectiveTo >= month),
    )
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
}

export function payableMonths(
  contract: { startDate: Date; endDate: Date | null },
  rentDues: Pick<RentDue, 'id' | 'rentId' | 'month' | 'amount' | 'status'>[],
  rents: RentInForce[],
  now: Date,
): PayableMonth[] {
  const currentMonth = firstOfMonth(now);
  const dueByMonth = new Map(rentDues.map((d) => [d.month.getTime(), d]));
  const result: PayableMonth[] = [];

  for (const month of monthsBetween(
    contract.startDate,
    lastPayableMonth(contract.endDate, now),
  )) {
    const due = dueByMonth.get(month.getTime());
    if (due?.status === 'PAID') continue;

    const rent = due ? undefined : rentInForce(rents, month);
    if (!due && !rent) break;

    const status: PayableStatus =
      month > currentMonth
        ? 'ADVANCE'
        : due
          ? (due.status as PayableStatus)
          : (initialStatusOf(dueDateOf(month), now) as PayableStatus);

    result.push({
      month,
      amount: due ? due.amount : rent!.amount,
      status,
      rentId: due ? due.rentId : rent!.id,
      rentDueId: due ? due.id : null,
    });
  }
  return result;
}
