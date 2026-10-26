import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { components } from "@/lib/api/schema";
import {
  AUTH_COOKIE_NAME,
  DEFAULT_AUTHENTICATED_PATH,
  LOGIN_PATH,
  LOGOUT_PATH,
} from "@/lib/auth";

type UserEntity = components["schemas"]["UserEntity"];

type Session =
  | { status: "authenticated"; user: UserEntity }
  | { status: "anonymous" }
  | { status: "rejected" }
  | { status: "error" };

const loadSession = cache(async (): Promise<Session> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return { status: "anonymous" };

  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) return { status: "error" };

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return { status: "error" };
  }

  if (response.status === 401) return { status: "rejected" };
  if (!response.ok) return { status: "error" };

  try {
    return { status: "authenticated", user: (await response.json()) as UserEntity };
  } catch {
    return { status: "error" };
  }
});

export async function getCurrentUser(): Promise<UserEntity | null> {
  const session = await loadSession();
  return session.status === "authenticated" ? session.user : null;
}

export async function requireUser(): Promise<UserEntity> {
  const session = await loadSession();
  if (session.status === "authenticated") return session.user;

  if (session.status === "rejected") redirect(LOGOUT_PATH);
  if (session.status === "anonymous") redirect(LOGIN_PATH);

  // Pas de redirection : avec le cookie, /login renverrait ici et bouclerait
  throw new Error("API indisponible");
}

export async function requireAdmin(): Promise<UserEntity> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(DEFAULT_AUTHENTICATED_PATH);
  return user;
}

export type { UserEntity };
