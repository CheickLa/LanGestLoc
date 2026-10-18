import { backendFetch, backendFetchAll } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";
import type { PaymentContract } from "@/components/payments/payment-dialog";
import { contractLabel } from "@/lib/payments";

import { PaymentsPageClient } from "./payments-page-client";

type PaymentWithRelations = components["schemas"]["PaymentWithRelationsEntity"];
type ContractListItem = components["schemas"]["ContractListItemEntity"];

export type PaymentsPage = {
  items: PaymentWithRelations[];
  total: number;
  skip: number;
  take: number;
};

const DEFAULT_TAKE = 20;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string; q?: string }>;
}) {
  const { skip: skipParam, q } = await searchParams;

  const skip = Math.max(0, Number(skipParam ?? 0) || 0);
  const search = (q ?? "").trim();

  const params = new URLSearchParams({
    skip: String(skip),
    take: String(DEFAULT_TAKE),
  });
  if (search) params.set("search", search);

  const [data, contractItems] = await Promise.all([
    backendFetch<PaymentsPage>(`/payments?${params.toString()}`),
    backendFetchAll<ContractListItem>("/contracts"),
  ]);

  const contracts: PaymentContract[] = contractItems
    .filter((c) => c.status === "ACTIVE")
    .map((c) => ({ id: c.id, label: contractLabel(c) }));

  return <PaymentsPageClient data={data} search={search} contracts={contracts} />;
}
