import {
  backendFetchAll,
  backendFetchPage,
  type Paginated,
} from "@/lib/api/server";
import type { components } from "@/lib/api/schema";
import type { PaymentContract } from "@/components/payments/payment-dialog";
import { contractLabel } from "@/lib/payments";

import { PaymentsPageClient } from "./payments-page-client";

type PaymentWithRelations = components["schemas"]["PaymentWithRelationsEntity"];
type ContractListItem = components["schemas"]["ContractListItemEntity"];

export type PaymentsPage = Paginated<PaymentWithRelations>;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string; q?: string }>;
}) {
  const [{ data, search }, contractItems] = await Promise.all([
    backendFetchPage<PaymentWithRelations>("/payments", await searchParams),
    backendFetchAll<ContractListItem>("/contracts"),
  ]);

  const contracts: PaymentContract[] = contractItems
    .filter((c) => c.status === "ACTIVE")
    .map((c) => ({ id: c.id, label: contractLabel(c) }));

  return <PaymentsPageClient data={data} search={search} contracts={contracts} />;
}
