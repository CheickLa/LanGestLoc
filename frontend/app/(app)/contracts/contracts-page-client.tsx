"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CalendarRange, CircleDot, FileText, Plus, Store, User } from "lucide-react";

import type { components } from "@/lib/api/schema";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatGNF, formatDate } from "@/lib/format";
import { useSearchQuery } from "@/lib/use-search-query";
import type { ContractsPage, ContractFormData } from "./page";
import { ContractFormDialog } from "./contract-form-dialog";
import { PdfLink } from "@/components/pdf-link";

type ContractListItem = components["schemas"]["ContractListItemEntity"];

function period(row: ContractListItem) {
  return `${formatDate(row.startDate)} → ${row.endDate ? formatDate(row.endDate) : "—"}`;
}

export function ContractsPageClient({
  data,
  isAdmin,
  search,
  formData,
}: {
  data: ContractsPage;
  isAdmin: boolean;
  search: string;
  formData: ContractFormData | null;
}) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useSearchQuery(search, "/contracts");
  const [createOpen, setCreateOpen] = useState(false);

  function goToPage(nextSkip: number) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (nextSkip > 0) params.set("skip", String(nextSkip));
    const query = params.toString();
    router.push(`/contracts${query ? `?${query}` : ""}`);
  }

  const columns: Column<ContractListItem>[] = [
    {
      key: "local",
      header: "Local",
      icon: Store,
      cell: (row) => <span className="text-foreground">{row.local.name}</span>,
    },
    {
      key: "tenant",
      header: "Locataire",
      icon: User,
      cell: (row) => (
        <div>
          <div className="text-foreground">{row.tenant.name}</div>
          {row.tenant.activity ? (
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              {row.tenant.activity}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "period",
      header: "Période",
      icon: CalendarRange,
      cell: (row) => <span className="text-muted-foreground">{period(row)}</span>,
    },
    {
      key: "rent",
      header: "Loyer actuel",
      icon: Banknote,
      className: "text-right whitespace-nowrap",
      cell: (row) => (
        <span className="tabular-nums">
          {row.activeRent ? formatGNF(row.activeRent.amount) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Statut",
      icon: CircleDot,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "document",
      header: "Bail",
      icon: FileText,
      className: "w-px whitespace-nowrap text-center",
      cell: (row) => (
        <PdfLink
          href={`/api/contracts/${row.id}/document`}
          title="Ouvrir le bail"
          aria-label="Ouvrir le bail"
          onClick={(e) => e.stopPropagation()}
          className="inline-grid size-8 place-items-center rounded-lg text-primary transition-colors hover:bg-info"
        >
          <FileText className="size-4" />
        </PdfLink>
      ),
    },
  ];

  function renderMobileCard(row: ContractListItem) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/contracts/${row.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(`/contracts/${row.id}`);
          }
        }}
        className="cursor-pointer rounded-xl border border-border p-3.5"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-medium text-foreground">{row.local.name}</div>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              {row.tenant.name}
              {row.tenant.activity ? ` · ${row.tenant.activity}` : ""}
            </div>
          </div>
          <StatusBadge status={row.status} />
        </div>
        <dl className="mt-2.5 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Période</dt>
            <dd className="text-foreground">{period(row)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Loyer</dt>
            <dd className="tabular-nums text-foreground">
              {row.activeRent ? formatGNF(row.activeRent.amount) : "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex justify-end border-t border-border/60 pt-3">
          <PdfLink
            href={`/api/contracts/${row.id}/document`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
          >
            <FileText className="size-3.5" /> Bail PDF
          </PdfLink>
        </div>
      </div>
    );
  }

  const emptyState = (
    <p className="text-center text-sm text-muted-foreground">
      {search
        ? `Aucun contrat ne correspond à « ${search} ».`
        : "Aucun contrat enregistré pour le moment."}
    </p>
  );

  return (
    <>
      <DataTable<ContractListItem>
        title="Contrats"
        action={
          isAdmin && formData ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Nouveau contrat
            </Button>
          ) : undefined
        }
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: "Rechercher un contrat…",
        }}
        columns={columns}
        data={data.items}
        getRowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/contracts/${row.id}`)}
        renderMobileCard={renderMobileCard}
        pagination={{
          total: data.total,
          skip: data.skip,
          take: data.take,
          onPageChange: goToPage,
        }}
        emptyState={emptyState}
      />

      {isAdmin && formData ? (
        <ContractFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          locals={formData.locals}
          tenants={formData.tenants}
        />
      ) : null}
    </>
  );
}
