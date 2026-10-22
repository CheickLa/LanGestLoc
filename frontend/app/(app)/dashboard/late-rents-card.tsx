"use client";

import { useRouter } from "next/navigation";
import { Banknote, CalendarX, Check, CircleAlert, Store } from "lucide-react";

import type { components } from "@/lib/api/schema";
import type { Paginated } from "@/lib/api/server";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatGNF } from "@/lib/format";
import { monthOf, periodLabel } from "@/lib/months";

type Late = components["schemas"]["DashboardEntity"]["late"];
type LateContract = components["schemas"]["DashboardLateContractEntity"];

function MonthsBadge({ row }: { row: LateContract }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-danger md:whitespace-normal px-2.5 py-0.5 text-xs text-danger-foreground">
      {periodLabel(row.months.map(monthOf))}
    </span>
  );
}

export function LateRentsCard({
  late,
  contracts,
}: {
  late: Late;
  contracts: Paginated<LateContract>;
}) {
  const router = useRouter();

  function openContract(row: LateContract) {
    router.push(`/contracts/${row.contractId}`);
  }

  function goToPage(nextSkip: number) {
    router.push(`/dashboard${nextSkip > 0 ? `?skip=${nextSkip}` : ""}`, { scroll: false });
  }

  const columns: Column<LateContract>[] = [
    {
      key: "local",
      header: "Local",
      icon: Store,
      cell: (row) => (
        <div>
          <div className="text-foreground">
            {row.local.code} · {row.local.name}
          </div>
          <div className="mt-0.5 text-[12.5px] text-muted-foreground">{row.tenant.name}</div>
        </div>
      ),
    },
    {
      key: "months",
      header: "Mois en retard",
      icon: CalendarX,
      cell: (row) => <MonthsBadge row={row} />,
    },
    {
      key: "amount",
      header: "Montant",
      icon: Banknote,
      className: "text-right whitespace-nowrap",
      cell: (row) => <span className="tabular-nums">{formatGNF(row.amount)}</span>,
    },
  ];

  function renderMobileCard(row: LateContract) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => openContract(row)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openContract(row);
          }
        }}
        className="cursor-pointer rounded-xl border border-border p-3.5"
      >
        <div className="text-foreground">
          {row.local.code} · {row.local.name}
        </div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">{row.tenant.name}</div>
        <div className="mt-2">
          <MonthsBadge row={row} />
        </div>
        <dl className="mt-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Montant</dt>
            <dd className="tabular-nums text-foreground">{formatGNF(row.amount)}</dd>
          </div>
        </dl>
      </div>
    );
  }

  const emptyState = (
    <div className="flex items-center justify-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
        <Check className="size-4" strokeWidth={2} aria-hidden />
      </span>
      <span className="text-muted-foreground">
        Aucun loyer en retard : tous les mois échus sont payés.
      </span>
    </div>
  );

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 md:gap-y-1">
        {/* Les lecteurs d'écran lisent le titre du DataTable */}
        <p aria-hidden className="flex items-center gap-2 text-base font-semibold">
          <CircleAlert className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden />
          Loyers en retard
        </p>
        {contracts.total > 0 ? (
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {formatGNF(late.amount)}
            <span className="max-md:sr-only"> à encaisser</span>
          </span>
        ) : null}
      </div>

      <DataTable<LateContract>
        title="Loyers en retard"
        columns={columns}
        data={contracts.items}
        getRowKey={(row) => row.contractId}
        onRowClick={openContract}
        renderMobileCard={renderMobileCard}
        pagination={{
          total: contracts.total,
          skip: contracts.skip,
          take: contracts.take,
          onPageChange: goToPage,
        }}
        emptyState={emptyState}
      />
    </section>
  );
}
