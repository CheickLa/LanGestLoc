"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  MoreHorizontal,
  TrendingUp,
  XCircle,
  Ban,
  FileText,
} from "lucide-react";

import type { components } from "@/lib/api/schema";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatGNF, formatDate } from "@/lib/format";

import { IncreaseRentDialog } from "./increase-rent-dialog";
import { TerminateContractDialog } from "./terminate-contract-dialog";
import { CancelContractDialog } from "./cancel-contract-dialog";

type ContractDetail = components["schemas"]["ContractDetailEntity"];
type RentDue = components["schemas"]["RentDueEntity"];
type Rent = components["schemas"]["RentEntity"];
type Payment = components["schemas"]["PaymentWithLinesEntity"];

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Espèces",
  ORANGE_MONEY: "Orange Money",
  MOBILE_MONEY: "Mobile Money",
};
const PAYMENT_TYPE_LABEL: Record<string, string> = {
  RENT: "Loyer",
  DEPOSIT_HELD: "Caution",
  DEPOSIT_REFUND: "Restitution caution",
};

function monthLabel(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function ContractDetailClient({
  contract,
  rentDues,
  rents,
  payments,
  isAdmin,
}: {
  contract: ContractDetail;
  rentDues: RentDue[];
  rents: Rent[];
  payments: Payment[];
  isAdmin: boolean;
}) {
  const [action, setAction] = useState<"increase" | "terminate" | "cancel" | null>(null);

  const isActive = contract.status === "ACTIVE";
  const canAct = isAdmin && isActive;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/contracts"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Contrats
      </Link>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">{contract.local.name}</h1>
            <StatusBadge status={contract.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {contract.tenant.name}
            {contract.tenant.activity ? ` · ${contract.tenant.activity}` : ""}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canAct ? (
              <>
                <DropdownMenuItem onClick={() => setAction("increase")}>
                  <TrendingUp className="size-4" /> Augmenter le loyer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAction("terminate")}>
                  <XCircle className="size-4" /> Résilier
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setAction("cancel")}
                  className="text-danger-foreground"
                >
                  <Ban className="size-4" /> Annuler
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem asChild>
              <a
                href={`/api/contracts/${contract.id}/document`}
                target="_blank"
                rel="noopener"
              >
                <FileText className="size-4" /> Ouvrir le bail
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Synthèse */}
      <div className="mb-4 rounded-2xl border border-border bg-background p-5 shadow-[var(--card-shadow)]">
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Kv label="Local" value={contract.local.name} />
          <Kv label="Locataire" value={contract.tenant.name} />
          <Kv
            label="Période"
            value={`${formatDate(contract.startDate)} → ${contract.endDate ? formatDate(contract.endDate) : "—"}`}
          />
          <Kv
            label="Loyer actuel"
            value={contract.activeRent ? `${formatGNF(contract.activeRent.amount)} / mois` : "—"}
          />
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-faint">Caution</dt>
            <dd className="mt-1 flex items-center gap-2 text-sm font-medium tabular-nums">
              {contract.deposit ? formatGNF(contract.deposit.amount) : "—"}
              {contract.deposit ? <StatusBadge status={contract.deposit.status} /> : null}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-faint">Bail</dt>
            <dd className="mt-1">
              <a
                href={`/api/contracts/${contract.id}/document`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
              >
                <FileText className="size-4" />
                {contract.document ? contract.document.documentNo : "Ouvrir"}
              </a>
            </dd>
          </div>
        </dl>
      </div>

      {/* Onglets */}
      <div className="rounded-2xl border border-border bg-background shadow-[var(--card-shadow)]">
        <Tabs defaultValue="echeances" className="w-full">
          <TabsList className="m-2">
            <TabsTrigger value="echeances">Échéances ({rentDues.length})</TabsTrigger>
            <TabsTrigger value="loyers">Loyers ({rents.length})</TabsTrigger>
            <TabsTrigger value="paiements">Paiements ({payments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="echeances">
            <SimpleTable
              head={["Mois", "Montant", "Échéance", "Statut"]}
              empty="Aucune échéance."
              rows={rentDues.map((d) => [
                monthLabel(d.month),
                <span key="m" className="tabular-nums">{formatGNF(d.amount)}</span>,
                <span key="d" className="text-muted-foreground">{formatDate(d.dueDate)}</span>,
                <StatusBadge key="s" status={d.status} />,
              ])}
            />
          </TabsContent>

          <TabsContent value="loyers">
            <SimpleTable
              head={["Montant", "Effectif du", "Au", ""]}
              empty="Aucun loyer."
              rows={rents.map((r) => [
                <span key="a" className="tabular-nums">{formatGNF(r.amount)}</span>,
                formatDate(r.effectiveFrom),
                <span key="t" className="text-muted-foreground">
                  {r.effectiveTo ? formatDate(r.effectiveTo) : "—"}
                </span>,
                r.effectiveTo === null ? <StatusBadge key="c" status="ACTIVE" /> : "",
              ])}
            />
          </TabsContent>

          <TabsContent value="paiements">
            <SimpleTable
              head={["Date", "Montant", "Méthode", "Type", "Reçu"]}
              empty="Aucun paiement."
              rows={payments.map((p) => [
                formatDate(p.paymentDate),
                <span key="a" className="tabular-nums">{formatGNF(p.amount)}</span>,
                <span key="m" className="text-muted-foreground">
                  {PAYMENT_METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}
                </span>,
                PAYMENT_TYPE_LABEL[p.type] ?? p.type,
                <a
                  key="r"
                  href={`/api/receipts/by-payment/${p.id}`}
                  target="_blank"
                  rel="noopener"
                  title="Ouvrir le reçu"
                  aria-label="Ouvrir le reçu"
                  className="inline-grid size-8 place-items-center rounded-lg text-primary hover:bg-info"
                >
                  <FileText className="size-4" />
                </a>,
              ])}
            />
          </TabsContent>
        </Tabs>
      </div>

      <IncreaseRentDialog
        open={action === "increase"}
        onOpenChange={(o) => setAction(o ? "increase" : null)}
        contractId={contract.id}
        currentAmount={contract.activeRent?.amount ?? null}
        currentEffectiveFrom={contract.activeRent?.effectiveFrom ?? null}
      />
      <TerminateContractDialog
        open={action === "terminate"}
        onOpenChange={(o) => setAction(o ? "terminate" : null)}
        contractId={contract.id}
        startDate={contract.startDate}
        onCancelInstead={() => setAction("cancel")}
      />
      <CancelContractDialog
        open={action === "cancel"}
        onOpenChange={(o) => setAction(o ? "cancel" : null)}
        contractId={contract.id}
      />
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function SimpleTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th
              key={i}
              className="border-y border-border bg-muted/60 px-4 py-2.5 text-left text-[11px] font-normal uppercase tracking-wide text-faint"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, r) => (
          <tr key={r} className="last:border-0">
            {cells.map((c, i) => (
              <td key={i} className="border-b border-border/60 px-4 py-3 align-middle">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
