// Mois calendaires en UTC, qui est l'heure de Conakry.

export function firstOfMonth(date: Date, offset = 0): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1),
  );
}

export function isLastDayOfMonth(date: Date): boolean {
  const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return nextDay.getUTCDate() === 1;
}

export function monthsBetween(from: Date, to: Date): Date[] {
  const months: Date[] = [];
  for (
    let month = firstOfMonth(from);
    month <= to;
    month = firstOfMonth(month, 1)
  ) {
    months.push(month);
  }
  return months;
}
