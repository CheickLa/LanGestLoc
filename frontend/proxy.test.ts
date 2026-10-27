import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { proxy } from "./proxy";

function request(path: string, loggedIn: boolean): NextRequest {
  const headers: Record<string, string> = loggedIn ? { cookie: `${AUTH_COOKIE_NAME}=jwt` } : {};
  return new NextRequest(`http://localhost:3001${path}`, { headers });
}

function redirectPath(path: string, loggedIn: boolean): string | null {
  const location = proxy(request(path, loggedIn)).headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("proxy", () => {
  it("renvoie vers /login une page de l'appli sans session", () => {
    expect(redirectPath("/contracts", false)).toBe("/login");
  });

  it("renvoie vers le tableau de bord l'accueil et /login avec session", () => {
    expect(redirectPath("/", true)).toBe("/dashboard");
    expect(redirectPath("/login", true)).toBe("/dashboard");
  });

  it("laisse passer l'accueil et /login sans session", () => {
    expect(redirectPath("/", false)).toBeNull();
    expect(redirectPath("/login", false)).toBeNull();
  });

  it("ouvre la page de confidentialité avec ou sans session", () => {
    expect(redirectPath("/confidentialite", false)).toBeNull();
    expect(redirectPath("/confidentialite", true)).toBeNull();
  });
});
