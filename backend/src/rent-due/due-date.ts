import { RentDueStatus } from '@generated/prisma/client';

export function dueDateOf(month: Date): Date {
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 5));
}

export function initialStatusOf(
  dueDate: Date,
  now = new Date(),
): RentDueStatus {
  return dueDate < now ? RentDueStatus.LATE : RentDueStatus.PENDING;
}
