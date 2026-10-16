const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-02-01T00:00:00.000Z" → "2026-02" (mois UTC, comme le backend). */
export function monthOf(value: string | Date): string {
  const d = new Date(value);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

function shiftMonth(value: string | Date, offset: number): string {
  const d = new Date(value);
  return monthOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)));
}

/** Mois suivant celui de la date donnée, au format "YYYY-MM". */
export function nextMonthOf(value: string | Date): string {
  return shiftMonth(value, 1);
}

/** Mois précédant celui de la date donnée, au format "YYYY-MM". */
export function previousMonthOf(value: string | Date): string {
  return shiftMonth(value, -1);
}

/** "2026-02" → true ; "2026-13", "10/2026" → false. */
export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** "2026-02" → "février 2026". */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** "2026-02" → "2026-02-01". */
export function firstDayOf(ym: string): string {
  return `${ym}-01`;
}

/** "2026-02" → "2026-02-28". */
export function lastDayOf(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
