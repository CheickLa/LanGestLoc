import { getCurrentUser } from "@/lib/auth-server";
import { backendFetchPage, type Paginated } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";

import { TenantsPageClient } from "./tenants-page-client";

type TenantListItem = components["schemas"]["TenantListItemEntity"];

export type TenantsPage = Paginated<TenantListItem>;

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  const { data, search } = await backendFetchPage<TenantListItem>(
    "/tenants",
    await searchParams,
  );

  return (
    <TenantsPageClient
      data={data}
      isAdmin={user?.role === "ADMIN"}
      search={search}
    />
  );
}
