/** Compteur de repli : l'IP vue par l'API (celle du client derrière Caddy si `trust proxy` est réglé) */
export function trackByIp(ip: unknown): string {
  return `ip:${typeof ip === 'string' ? ip : 'inconnue'}`;
}

/**
 * Traceur de `POST /auth/login` : un compteur par e-mail, normalisé comme
 * `LoginDto`, pour freiner le brute-force sur un compte même quand toutes
 * les requêtes arrivent de la même IP (BFF Vercel). Sans e-mail exploitable,
 * repli sur l'IP.
 */
export function trackLoginByEmail(req: Record<string, unknown>): string {
  const { body, ip } = req;
  const email =
    typeof body === 'object' &&
    body !== null &&
    'email' in body &&
    typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : '';

  return email ? `login:${email}` : trackByIp(ip);
}
