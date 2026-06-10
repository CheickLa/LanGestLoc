import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { components } from "@/lib/api/schema";
import { AUTH_COOKIE_NAME, LOGIN_PATH } from "@/lib/auth";

type UserEntity = components["schemas"]["UserEntity"];

/**
 * Valide la session côté serveur en appelant le backend.
 * `cache()` dédoublonne l'appel sur une même requête (layout + page).
 * @returns l'utilisateur si le token est valide, sinon `null`.
 */
export const getCurrentUser = cache(async (): Promise<UserEntity | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) return null;

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  try {
    return (await response.json()) as UserEntity;
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<UserEntity> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

export type { UserEntity };
