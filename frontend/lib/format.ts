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
