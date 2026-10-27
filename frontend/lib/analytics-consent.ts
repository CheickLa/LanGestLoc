export type ConsentChoice = "granted" | "denied";

export const CONSENT_STORAGE_KEY = "langestloc_analytics_consent";

// La CNIL recommande de redemander le choix au bout de six mois.
const CONSENT_LIFETIME_MONTHS = 6;

type StoredConsent = { choice: ConsentChoice; at: string };

function isStoredConsent(value: unknown): value is StoredConsent {
  if (typeof value !== "object" || value === null) return false;
  const { choice, at } = value as Record<string, unknown>;
  return (
    (choice === "granted" || choice === "denied") &&
    typeof at === "string" &&
    !Number.isNaN(Date.parse(at))
  );
}

export function readConsent(getStorage: () => Storage, now: Date): ConsentChoice | null {
  try {
    const raw = getStorage().getItem(CONSENT_STORAGE_KEY);
    if (raw === null) return null;
    const stored: unknown = JSON.parse(raw);
    if (!isStoredConsent(stored)) return null;
    const expiresAt = new Date(stored.at);
    expiresAt.setUTCMonth(expiresAt.getUTCMonth() + CONSENT_LIFETIME_MONTHS);
    return now < expiresAt ? stored.choice : null;
  } catch {
    return null;
  }
}

export function writeConsent(getStorage: () => Storage, choice: ConsentChoice, now: Date): void {
  const stored: StoredConsent = { choice, at: now.toISOString() };
  try {
    getStorage().setItem(CONSENT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Stockage bloqué : le bandeau reviendra à la prochaine visite.
  }
}

export function gaCookieNames(cookieHeader: string): string[] {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.split("=")[0].trim())
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));
}
