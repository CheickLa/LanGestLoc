/**
 * Nombre de proxys de confiance devant l'API (`TRUST_PROXY_HOPS`) : avec 1,
 * `req.ip` devient l'IP du client vue par Caddy au lieu de celle de Caddy.
 * 0 par défaut : sans proxy devant, faire confiance à `X-Forwarded-For`
 * permettrait à n'importe qui de falsifier son IP.
 */
export function parseTrustProxyHops(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 0;

  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(
      `TRUST_PROXY_HOPS doit être un entier positif ou nul (reçu : "${raw}")`,
    );
  }
  return hops;
}
