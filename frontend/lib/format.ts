/**
 * Formate un montant en franc guinéen (GNF).
 * @example formatGNF(250000) // "250 000 GNF"
 */
export function formatGNF(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "GNF",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formate un nombre entier avec séparateur de milliers, sans unité.
 * @example formatNumber(12200000) // "12 200 000"
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

/** Formate une date ISO en JJ/MM/AAAA (UTC pour éviter le décalage de jour). */
export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
