"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import type { components } from "@/lib/api/schema";
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
  const [searchInput, setSearchInput] = useState(search);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });

  // Recherche serveur : pousse l'URL (reset à la 1re page) après un court délai.
  useEffect(() => {
    if (searchInput.trim() === search) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (searchInput.trim()) params.set("q", searchInput.trim());
      const query = params.toString();
      router.push(`/locals${query ? `?${query}` : ""}`);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput, search, router]);

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
      cell: (row) => <StatusBadge status={row.status} />,
    },
    ...(isAdmin
      ? [
          {
            key: "actions",
            header: "Actions",
            className: "w-px whitespace-nowrap text-center",
            cell: (row: LocalListItem) => (
              <div className="inline-flex justify-center gap-1">
                <button
                  type="button"
                  title="Modifier"
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
                  disabled={row.hasContracts}
                  onClick={() => setDialog({ kind: "delete", local: row })}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/30 disabled:hover:bg-transparent"
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
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
