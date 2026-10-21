import { getCurrentUser } from "@/lib/auth-server";
import {
  backendFetchAll,
  backendFetchPage,
  type Paginated,
} from "@/lib/api/server";
import type { components } from "@/lib/api/schema";

import { ContractsPageClient } from "./contracts-page-client";

type ContractListItem = components["schemas"]["ContractListItemEntity"];
type LocalListItem = components["schemas"]["LocalListItemEntity"];
type TenantListItem = components["schemas"]["TenantListItemEntity"];

export type ContractsPage = Paginated<ContractListItem>;

export type ContractFormData = {
  locals: LocalListItem[];
  tenants: TenantListItem[];
};

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  const { data, search } = await backendFetchPage<ContractListItem>(
    "/contracts",
    await searchParams,
  );

  const isAdmin = user?.role === "ADMIN";

  const formData: ContractFormData | null = isAdmin
    ? await Promise.all([
        backendFetchAll<LocalListItem>("/locals"),
        backendFetchAll<TenantListItem>("/tenants"),
      ]).then(([locals, tenants]) => ({
        locals: locals.filter((l) => l.status === "VACANT"),
        tenants,
      }))
    : null;

  return (
    <ContractsPageClient
      data={data}
      isAdmin={isAdmin}
      search={search}
      formData={formData}
    />
  );
}
