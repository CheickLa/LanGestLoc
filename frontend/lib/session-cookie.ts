/**
 * Durée de vie du cookie de session, en secondes : celle du jeton (`exp`), fixée
 * par le backend. `null` si le jeton est illisible, sans expiration ou expiré.
 */
export function sessionMaxAge(token: string, now = Date.now()): number | null {
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString(),
    );
    const exp = (payload as { exp?: unknown } | null)?.exp;
    if (typeof exp !== "number") return null;

    const maxAge = Math.floor(exp - now / 1000);
    return maxAge > 0 ? maxAge : null;
  } catch {
    return null;
  }
}
