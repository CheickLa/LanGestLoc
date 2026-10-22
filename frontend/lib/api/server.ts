import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { AUTH_COOKIE_NAME } from "@/lib/auth";

function backendUrl(): string {
  const url = process.env.BACKEND_URL;
  if (!url) throw new Error("BACKEND_URL manquant");
  return url;
}

async function authHeader(): Promise<Record<string, string>> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Lecture server-to-server (Server Components) qui relaie le cookie httpOnly
 * Lève une erreur si la réponse n'est pas OK (gérée par error.tsx / try/catch appelant)
 */
export async function backendFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${backendUrl()}${path}`, {
    headers: await authHeader(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend a répondu ${response.status} sur ${path}`);
  }

  return (await response.json()) as T;
}

export type Paginated<T> = {
  items: T[];
  total: number;
  skip: number;
  take: number;
};

/** Nombre de lignes par page des tableaux */
const PAGE_SIZE = 20;

/**
 * Page d'une liste lue depuis les paramètres d'URL `skip` et `q`. `pagePath`, le
 * chemin de la page côté front, vaut par défaut celui de l'API (`/tenants`…). Une
 * page vide au-delà de la fin (dernier élément supprimé, `skip` saisi à la main)
 * renvoie à la dernière page.
 */
export async function backendFetchPage<T>(
  path: string,
  { skip: skipParam, q }: { skip?: string; q?: string },
  pagePath = path,
): Promise<{ data: Paginated<T>; search: string }> {
  const skip = Math.max(0, Number(skipParam ?? 0) || 0);
  const search = (q ?? "").trim();

  const params = new URLSearchParams({
    skip: String(skip),
    take: String(PAGE_SIZE),
  });
  if (search) params.set("search", search);

  const data = await backendFetch<Paginated<T>>(`${path}?${params.toString()}`);

  if (data.items.length === 0 && skip > 0 && data.total > 0) {
    const lastSkip = Math.floor((data.total - 1) / PAGE_SIZE) * PAGE_SIZE;
    const target = new URLSearchParams();
    if (search) target.set("q", search);
    if (lastSkip > 0) target.set("skip", String(lastSkip));
    const query = target.toString();
    redirect(query ? `${pagePath}?${query}` : pagePath);
  }

  return { data, search };
}

/** Taille de page maximale acceptée par le backend (`PaginationDto.take`) */
const MAX_PAGE_SIZE = 100;

/**
 * Lecture complète d'une liste paginée (`{ items, total }`) : enchaîne les pages
 * jusqu'à `total`. Pour les listes de sélection qui doivent tout proposer.
 */
export async function backendFetchAll<T>(path: string): Promise<T[]> {
  const separator = path.includes("?") ? "&" : "?";
  const items: T[] = [];
  let total = 0;

  do {
    const page = await backendFetch<{ items: T[]; total: number }>(
      `${path}${separator}skip=${items.length}&take=${MAX_PAGE_SIZE}`,
    );
    if (page.items.length === 0) break;
    items.push(...page.items);
    total = page.total;
  } while (items.length < total);

  return items;
}

/**
 * Mutation depuis un Route Handler. Relaie le cookie httpOnly vers NestJS
 * et renvoie une NextResponse qui reflète le statut + corps du backend
 * (y compris les erreurs 400 / 403 / 409 avec leur message).
 */
export async function backendMutate(
  path: string,
  init: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown },
): Promise<NextResponse> {
  let response: Response;
  try {
    response = await fetch(`${backendUrl()}${path}`, {
      method: init.method,
      headers: {
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(await authHeader()),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "Service indisponible. Réessayez plus tard." },
      { status: 502 },
    );
  }

  if (response.status === 204) return new NextResponse(null, { status: 204 });

  const data = await response.json().catch(() => null);
  return NextResponse.json(data, { status: response.status });
}

/**
 * Relaie une réponse binaire du backend (PDF) en streaming, en propageant
 * le cookie httpOnly. À utiliser pour les téléchargements (bail, reçu).
 */
export async function backendStream(path: string): Promise<Response> {
  try {
    return await fetch(`${backendUrl()}${path}`, {
      headers: await authHeader(),
      cache: "no-store",
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
