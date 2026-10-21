import { getCurrentUser } from "@/lib/auth-server";
import { backendFetchPage, type Paginated } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";

import { LocalsPageClient } from "./locals-page-client";

type LocalListItem = components["schemas"]["LocalListItemEntity"];

export type LocalsPage = Paginated<LocalListItem>;

export default async function LocalsPage({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  const { data, search } = await backendFetchPage<LocalListItem>(
    "/locals",
    await searchParams,
  );

  return (
    <LocalsPageClient
      data={data}
      isAdmin={user?.role === "ADMIN"}
      search={search}
    />
  );
}
