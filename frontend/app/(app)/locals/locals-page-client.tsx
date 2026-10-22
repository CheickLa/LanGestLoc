"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleDot, Pencil, Plus, Settings2, Store, Trash2, User } from "lucide-react";

import type { components } from "@/lib/api/schema";
import { useSearchQuery } from "@/lib/use-search-query";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { LocalsPage } from "./page";
import { LocalFormDialog } from "./local-form-dialog";
import { DeleteLocalDialog } from "./delete-local-dialog";

type LocalListItem = components["schemas"]["LocalListItemEntity"];

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; local: LocalListItem }
  | { kind: "delete"; local: LocalListItem };

export function LocalsPageClient({
  data,
  isAdmin,
  search,
}: {
  data: LocalsPage;
  isAdmin: boolean;
  search: string;
}) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useSearchQuery(search, "/locals");
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });

  function goToPage(nextSkip: number) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (nextSkip > 0) params.set("skip", String(nextSkip));
    const query = params.toString();
    router.push(`/locals${query ? `?${query}` : ""}`);
  }

  function closeAndRefresh() {
    setDialog({ kind: "closed" });
    router.refresh();
  }

  const columns: Column<LocalListItem>[] = [
    {
      key: "local",
      header: "Local",
      icon: Store,
      cell: (row) => (
        <div>
          <div className="font-mono text-[11.5px] uppercase tracking-wide text-muted-foreground">
            {row.code}
          </div>
          <div className="text-foreground">{row.name}</div>
        </div>
      ),
    },
    {
      key: "tenant",
      header: "Locataire",
      icon: User,
      cell: (row) =>
        row.currentTenant ? (
          <span className="text-muted-foreground">{row.currentTenant.name}</span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "status",
      header: "Statut",
      icon: CircleDot,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    ...(isAdmin
      ? [
          {
            key: "actions",
            header: "Actions",
            icon: Settings2,
            className: "w-px whitespace-nowrap text-center",
            cell: (row: LocalListItem) => (
              <div className="inline-flex justify-center gap-1">
                <button
                  type="button"
                  title="Modifier"
                  aria-label="Modifier"
                  onClick={() => setDialog({ kind: "edit", local: row })}
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
                  onClick={() => setDialog({ kind: "delete", local: row })}
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

  function renderMobileCard(row: LocalListItem) {
    return (
      <div className="rounded-xl border border-border p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-medium text-foreground">{row.name}</div>
            <div className="mt-0.5 font-mono text-[11.5px] uppercase tracking-wide text-muted-foreground">
              {row.code}
            </div>
          </div>
          <StatusBadge status={row.status} />
        </div>
        <div className="mt-2.5 text-sm">
          <span className="text-muted-foreground">Locataire&nbsp;·&nbsp;</span>
          {row.currentTenant ? (
            <span className="text-foreground">{row.currentTenant.name}</span>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          )}
        </div>
        {isAdmin ? (
          <div className="mt-3 flex justify-end gap-2 border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={() => setDialog({ kind: "edit", local: row })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
            >
              <Pencil className="size-3.5" /> Modifier
            </button>
            <button
              type="button"
              disabled={row.hasContracts}
              onClick={() => setDialog({ kind: "delete", local: row })}
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
        ? `Aucun local ne correspond à « ${search} ».`
        : "Aucun local enregistré pour le moment."}
    </p>
  );

  return (
    <>
      <DataTable<LocalListItem>
        title="Locaux"
        action={
          isAdmin ? (
            <Button size="sm" onClick={() => setDialog({ kind: "create" })}>
              <Plus className="size-4" /> Nouveau local
            </Button>
          ) : undefined
        }
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: "Rechercher un local…",
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

      <LocalFormDialog
        open={dialog.kind === "create" || dialog.kind === "edit"}
        local={dialog.kind === "edit" ? dialog.local : null}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "closed" });
        }}
        onSuccess={closeAndRefresh}
      />

      <DeleteLocalDialog
        open={dialog.kind === "delete"}
        local={dialog.kind === "delete" ? dialog.local : null}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "closed" });
        }}
        onSuccess={closeAndRefresh}
      />
    </>
  );
}
