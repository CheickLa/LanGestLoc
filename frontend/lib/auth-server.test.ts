import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const token = vi.hoisted(() => ({ value: "jwt" as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (token.value ? { value: token.value } : undefined),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

import { requireUser } from "./auth-server";

function backendAnswers(response: () => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async () => response()));
}

beforeEach(() => {
  token.value = "jwt";
  vi.stubEnv("BACKEND_URL", "http://backend");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("requireUser", () => {
  it("envoie vers /login sans cookie", async () => {
    token.value = undefined;
    await expect(requireUser()).rejects.toThrow("redirect:/login");
  });

  it("déconnecte quand l'API refuse le token", async () => {
    backendAnswers(() => new Response(null, { status: 401 }));
    await expect(requireUser()).rejects.toThrow("redirect:/api/auth/logout");
  });

  // Le cookie reste : /login renverrait vers /dashboard, qui rappellerait /auth/me
  it.each([
    ["429", () => new Response(null, { status: 429 })],
    ["503", () => new Response(null, { status: 503 })],
    ["API injoignable", () => Promise.reject(new TypeError("fetch failed"))],
  ])("ne redirige pas quand l'API ne répond pas (%s)", async (_, response) => {
    backendAnswers(response);
    await expect(requireUser()).rejects.toThrow("API indisponible");
  });
});
