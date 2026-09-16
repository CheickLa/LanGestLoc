import { getCurrentUser } from "@/lib/auth-server";
import { backendFetch } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";

import { ContractDetailClient } from "./contract-detail-client";

type ContractDetail = components["schemas"]["ContractDetailEntity"];
type RentDue = components["schemas"]["RentDueEntity"];
type Rent = components["schemas"]["RentEntity"];
type Payment = components["schemas"]["PaymentWithLinesEntity"];

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const [contract, rentDues, rents, payments] = await Promise.all([
    backendFetch<ContractDetail>(`/contracts/${id}`),
    backendFetch<RentDue[]>(`/rent-dues/contract/${id}`),
    backendFetch<Rent[]>(`/rents/contract/${id}`),
    backendFetch<Payment[]>(`/payments/contract/${id}`),
  ]);

  return (
    <ContractDetailClient
      contract={contract}
      rentDues={rentDues}
      rents={rents}
      payments={payments}
      isAdmin={user?.role === "ADMIN"}
    />
  );
}
