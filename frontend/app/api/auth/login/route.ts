import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { components } from "@/lib/api/schema";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

type LoginDto = components["schemas"]["LoginDto"];
type AuthTokenEntity = components["schemas"]["AuthTokenEntity"];

const DEFAULT_COOKIE_MAX_AGE = 60 * 60 * 24; // 1 jour

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const { email, password } = (body ?? {}) as Partial<LoginDto>;
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length === 0 ||
    password.length === 0
  ) {
    return NextResponse.json(
      { message: "Adresse e-mail et mot de passe requis." },
      { status: 400 },
    );
  }

  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { message: "Configuration serveur manquante." },
      { status: 500 },
    );
  }

  const payload: LoginDto = { email, password };

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${backendUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "Service indisponible. Réessayez plus tard." },
      { status: 502 },
    );
  }

  if (!backendResponse.ok) {
    if (backendResponse.status === 401) {
      return NextResponse.json(
        { message: "Identifiants invalides" },
        { status: 401 },
      );
    }
    if (backendResponse.status === 429) {
      return NextResponse.json(
        { message: "Trop de tentatives, réessayez dans une minute" },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { message: "Connexion impossible. Réessayez plus tard." },
      { status: backendResponse.status },
    );
  }

  let data: AuthTokenEntity;
  try {
    data = (await backendResponse.json()) as AuthTokenEntity;
  } catch {
    return NextResponse.json(
      { message: "Réponse inattendue du serveur." },
      { status: 502 },
    );
  }

  if (typeof data?.accessToken !== "string" || data.accessToken.length === 0) {
    return NextResponse.json(
      { message: "Réponse inattendue du serveur." },
      { status: 502 },
    );
  }

  const maxAge = Number(process.env.AUTH_COOKIE_MAX_AGE ?? DEFAULT_COOKIE_MAX_AGE);

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Number.isFinite(maxAge) && maxAge > 0 ? maxAge : DEFAULT_COOKIE_MAX_AGE,
  });

  return NextResponse.json({ ok: true });
}
