import { getCurrentUser } from "@/lib/auth-server";
import { backendFetch } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";

import { LocalsPageClient } from "./locals-page-client";

type LocalListItem = components["schemas"]["LocalListItemEntity"];

export type LocalsPage = {
  items: LocalListItem[];
  total: number;
  skip: number;
  take: number;
};

const DEFAULT_TAKE = 20;

export default async function LocalsPage({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  const { skip: skipParam, q } = await searchParams;

  const skip = Math.max(0, Number(skipParam ?? 0) || 0);
  const search = (q ?? "").trim();

  const params = new URLSearchParams({
    skip: String(skip),
    take: String(DEFAULT_TAKE),
  });
  if (search) params.set("search", search);

  const data = await backendFetch<LocalsPage>(`/locals?${params.toString()}`);

  return (
    <LocalsPageClient
      data={data}
      isAdmin={user?.role === "ADMIN"}
      search={search}
    />
  );
}
