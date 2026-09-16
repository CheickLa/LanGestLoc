import { getCurrentUser } from "@/lib/auth-server";
import { backendFetch, backendFetchAll } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";

import { ContractsPageClient } from "./contracts-page-client";

type ContractListItem = components["schemas"]["ContractListItemEntity"];
type LocalListItem = components["schemas"]["LocalListItemEntity"];
type TenantListItem = components["schemas"]["TenantListItemEntity"];

export type ContractsPage = {
  items: ContractListItem[];
  total: number;
  skip: number;
  take: number;
};

export type ContractFormData = {
  locals: LocalListItem[];
  tenants: TenantListItem[];
};

const DEFAULT_TAKE = 20;

export default async function ContractsPage({
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

  const data = await backendFetch<ContractsPage>(`/contracts?${params.toString()}`);

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
