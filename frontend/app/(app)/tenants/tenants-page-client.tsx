"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import type { components } from "@/lib/api/schema";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import type { TenantsPage } from "./page";
import { TenantFormDialog } from "./tenant-form-dialog";
import { DeleteTenantDialog } from "./delete-tenant-dialog";

type TenantListItem = components["schemas"]["TenantListItemEntity"];

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; tenant: TenantListItem }
  | { kind: "delete"; tenant: TenantListItem };

export function TenantsPageClient({
  data,
  isAdmin,
  search,
}: {
  data: TenantsPage;
  isAdmin: boolean;
  search: string;
}) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(search);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });

  useEffect(() => {
    if (searchInput.trim() === search) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (searchInput.trim()) params.set("q", searchInput.trim());
      const query = params.toString();
      router.push(`/tenants${query ? `?${query}` : ""}`);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput, search, router]);

  function goToPage(nextSkip: number) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (nextSkip > 0) params.set("skip", String(nextSkip));
    const query = params.toString();
    router.push(`/tenants${query ? `?${query}` : ""}`);
  }

  function closeAndRefresh() {
    setDialog({ kind: "closed" });
    router.refresh();
  }

  const columns: Column<TenantListItem>[] = [
    {
      key: "tenant",
      header: "Locataire",
      cell: (row) => (
        <div>
          <div className="text-foreground">{row.name}</div>
          {row.activity ? (
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              {row.activity}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Téléphone",
      cell: (row) => <span className="text-muted-foreground">{row.phone}</span>,
    },
    {
      key: "dateOfBirth",
      header: "Naissance",
      cell: (row) => (
        <span className="text-muted-foreground">
          {formatDate(row.dateOfBirth)}
        </span>
      ),
    },
    {
      key: "birthPlace",
      header: "Lieu de naissance",
      cell: (row) => (
        <span className="text-muted-foreground">{row.birthPlace}</span>
      ),
    },
    {
      key: "idNumber",
      header: "Pièce d'identité",
      cell: (row) => (
        <span className="font-mono text-[12.5px] text-muted-foreground">
          {row.idNumber}
        </span>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: "actions",
            header: "Actions",
            className: "w-px whitespace-nowrap text-center",
            cell: (row: TenantListItem) => (
              <div className="inline-flex justify-center gap-1">
                <button
                  type="button"
                  title="Modifier"
                  aria-label="Modifier"
                  onClick={() => setDialog({ kind: "edit", tenant: row })}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  title={
                    row.hasContracts
                      ? "Suppression bloquée (contrat lié)"
                      : "Supprimer"
                  }
                  aria-label="Supprimer"
                  disabled={row.hasContracts}
                  onClick={() => setDialog({ kind: "delete", tenant: row })}
                  className="grid size-8 place-items-center rounded-lg text-danger-foreground transition-colors hover:bg-danger disabled:cursor-not-allowed disabled:text-muted-foreground/30 disabled:hover:bg-transparent"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  function renderMobileCard(row: TenantListItem) {
    return (
      <div className="rounded-xl border border-border p-3.5">
        <div>
          <div className="font-medium text-foreground">{row.name}</div>
          {row.activity ? (
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              {row.activity}
            </div>
          ) : null}
        </div>
        <dl className="mt-2.5 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Téléphone</dt>
            <dd className="text-foreground">{row.phone}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Naissance</dt>
            <dd className="text-foreground">{formatDate(row.dateOfBirth)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Lieu de naissance</dt>
            <dd className="text-foreground">{row.birthPlace}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Pièce</dt>
            <dd className="font-mono text-[12.5px] text-foreground">
              {row.idNumber}
            </dd>
          </div>
        </dl>
        {isAdmin ? (
          <div className="mt-3 flex justify-end gap-2 border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={() => setDialog({ kind: "edit", tenant: row })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
            >
              <Pencil className="size-3.5" /> Modifier
            </button>
            <button
              type="button"
              disabled={row.hasContracts}
              onClick={() => setDialog({ kind: "delete", tenant: row })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-danger-foreground/25 px-3 py-1.5 text-xs text-danger-foreground disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:opacity-50"
            >
              <Trash2 className="size-3.5" /> Supprimer
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const emptyState = (
    <p className="text-center text-sm text-muted-foreground">
      {search
        ? `Aucun locataire ne correspond à « ${search} ».`
        : "Aucun locataire enregistré pour le moment."}
    </p>
  );

  return (
    <>
      <DataTable<TenantListItem>
        title="Locataires"
        action={
          isAdmin ? (
            <Button size="sm" onClick={() => setDialog({ kind: "create" })}>
              <Plus className="size-4" /> Nouveau locataire
            </Button>
          ) : undefined
        }
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: "Rechercher un locataire…",
        }}
        columns={columns}
        data={data.items}
        getRowKey={(row) => row.id}
        renderMobileCard={renderMobileCard}
        pagination={{
          total: data.total,
          skip: data.skip,
          take: data.take,
          onPageChange: goToPage,
        }}
        emptyState={emptyState}
      />

      <TenantFormDialog
        open={dialog.kind === "create" || dialog.kind === "edit"}
        tenant={dialog.kind === "edit" ? dialog.tenant : null}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "closed" });
        }}
        onSuccess={closeAndRefresh}
      />

      <DeleteTenantDialog
        open={dialog.kind === "delete"}
        tenant={dialog.kind === "delete" ? dialog.tenant : null}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "closed" });
        }}
        onSuccess={closeAndRefresh}
      />
    </>
  );
}
