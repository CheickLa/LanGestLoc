"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Calendar, FileText, Plus, Receipt, Store, Tag, User, Wallet } from "lucide-react";

import type { components } from "@/lib/api/schema";
import { PaymentDialog, type PaymentContract } from "@/components/payments/payment-dialog";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatDate, formatGNF } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, PAYMENT_TYPE_LABEL, paymentPeriod } from "@/lib/payments";
import { useSearchQuery } from "@/lib/use-search-query";
import type { PaymentsPage } from "./page";
import { PdfLink } from "@/components/pdf-link";

type PaymentRow = components["schemas"]["PaymentWithRelationsEntity"];

function receiptHref(row: PaymentRow) {
  return `/api/receipts/by-payment/${row.id}`;
}

export function PaymentsPageClient({
  data,
  search,
  contracts,
}: {
  data: PaymentsPage;
  search: string;
  contracts: PaymentContract[];
}) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useSearchQuery(search, "/payments");
  const [createOpen, setCreateOpen] = useState(false);

  function goToPage(nextSkip: number) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (nextSkip > 0) params.set("skip", String(nextSkip));
    const query = params.toString();
    router.push(`/payments${query ? `?${query}` : ""}`);
  }

  const columns: Column<PaymentRow>[] = [
    {
      key: "date",
      header: "Date",
      icon: Calendar,
      className: "whitespace-nowrap",
      cell: (row) => <span className="text-muted-foreground">{formatDate(row.paymentDate)}</span>,
    },
    {
      key: "local",
      header: "Local",
      icon: Store,
      cell: (row) => <span className="text-foreground">{row.contract.local.name}</span>,
    },
    {
      key: "tenant",
      header: "Locataire",
      icon: User,
      cell: (row) => (
        <div>
          <div className="text-foreground">{row.contract.tenant.name}</div>
          {row.contract.tenant.activity ? (
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              {row.contract.tenant.activity}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      icon: Tag,
      cell: (row) => (
        <div>
          <div className="text-foreground">{PAYMENT_TYPE_LABEL[row.type]}</div>
          {row.type === "RENT" ? (
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              {paymentPeriod(row)}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Montant",
      icon: Banknote,
      className: "text-right whitespace-nowrap",
      cell: (row) => <span className="tabular-nums">{formatGNF(row.amount)}</span>,
    },
    {
      key: "method",
      header: "Méthode",
      icon: Wallet,
      cell: (row) => (
        <span className="text-muted-foreground">{PAYMENT_METHOD_LABEL[row.paymentMethod]}</span>
      ),
    },
    {
      key: "receipt",
      header: "Reçu",
      icon: Receipt,
      className: "w-px whitespace-nowrap text-center",
      cell: (row) => (
        <PdfLink
          href={receiptHref(row)}
          title="Ouvrir le reçu"
          aria-label="Ouvrir le reçu"
          onClick={(e) => e.stopPropagation()}
          className="inline-grid size-8 place-items-center rounded-lg text-primary transition-colors hover:bg-info"
        >
          <FileText className="size-4" />
        </PdfLink>
      ),
    },
  ];

  function renderMobileCard(row: PaymentRow) {
    const open = () => router.push(`/contracts/${row.contractId}`);
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className="cursor-pointer rounded-xl border border-border p-3.5"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-medium text-foreground">{row.contract.local.name}</div>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              {row.contract.tenant.name}
              {row.contract.tenant.activity ? ` · ${row.contract.tenant.activity}` : ""}
            </div>
          </div>
          <div className="whitespace-nowrap font-medium tabular-nums text-foreground">
            {formatGNF(row.amount)}
          </div>
        </div>
        <dl className="mt-2.5 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{PAYMENT_TYPE_LABEL[row.type]}</dt>
            <dd className="text-right text-foreground">
              {row.type === "RENT" ? paymentPeriod(row) : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{formatDate(row.paymentDate)}</dt>
            <dd className="text-muted-foreground">{PAYMENT_METHOD_LABEL[row.paymentMethod]}</dd>
          </div>
        </dl>
        <div className="mt-3 flex justify-end border-t border-border/60 pt-3">
          <PdfLink
            href={receiptHref(row)}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
          >
            <FileText className="size-3.5" /> Reçu PDF
          </PdfLink>
        </div>
      </div>
    );
  }

  const emptyState = (
    <p className="text-center text-sm text-muted-foreground">
      {search
        ? `Aucun paiement ne correspond à « ${search} ».`
        : "Aucun paiement enregistré pour le moment."}
    </p>
  );

  return (
    <>
      <DataTable<PaymentRow>
        title="Paiements"
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Nouveau paiement
          </Button>
        }
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: "Rechercher un paiement…",
        }}
        columns={columns}
        data={data.items}
        getRowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/contracts/${row.contractId}`)}
        renderMobileCard={renderMobileCard}
        pagination={{
          total: data.total,
          skip: data.skip,
          take: data.take,
          onPageChange: goToPage,
        }}
        emptyState={emptyState}
      />

      <PaymentDialog open={createOpen} onOpenChange={setCreateOpen} contracts={contracts} />
    </>
  );
}
