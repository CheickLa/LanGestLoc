import { describe, expect, it } from "vitest";
import { sessionMaxAge } from "./session-cookie";

function jwtWith(payload: object): string {
  const encode = (part: object) =>
    Buffer.from(JSON.stringify(part)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const nowSeconds = NOW / 1000;

describe("sessionMaxAge", () => {
  it("fait durer le cookie jusqu'à l'expiration du jeton", () => {
    const token = jwtWith({ sub: 1, exp: nowSeconds + 45 * 24 * 3600 });

    expect(sessionMaxAge(token, NOW)).toBe(45 * 24 * 3600);
  });

  it("refuse un jeton déjà expiré", () => {
    expect(sessionMaxAge(jwtWith({ sub: 1, exp: nowSeconds }), NOW)).toBeNull();
  });

  it("refuse un jeton sans expiration", () => {
    expect(sessionMaxAge(jwtWith({ sub: 1 }), NOW)).toBeNull();
  });

  it("refuse un jeton illisible", () => {
    expect(sessionMaxAge("pas-un-jwt", NOW)).toBeNull();
    expect(sessionMaxAge("a.b%%.c", NOW)).toBeNull();
  });
});
