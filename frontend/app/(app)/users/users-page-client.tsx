"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import type { components } from "@/lib/api/schema";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import { roleLabel } from "@/lib/user";
import type { UsersPage } from "./page";
import { UserFormDialog } from "./user-form-dialog";
import { DeleteUserDialog } from "./delete-user-dialog";

type User = components["schemas"]["UserEntity"];

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; user: User }
  | { kind: "delete"; user: User };

export function UsersPageClient({
  data,
  currentUserId,
}: {
  data: UsersPage;
  currentUserId: number;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });

  function goToPage(nextSkip: number) {
    router.push(nextSkip > 0 ? `/users?skip=${nextSkip}` : "/users");
  }

  function closeAndRefresh() {
    setDialog({ kind: "closed" });
    router.refresh();
  }

  function nameCell(row: User) {
    return (
      <>
        {row.name}
        {row.id === currentUserId ? (
          <span className="ml-1.5 text-[12.5px] text-muted-foreground">
            (vous)
          </span>
        ) : null}
      </>
    );
  }

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "Nom",
      cell: (row) => <span className="text-foreground">{nameCell(row)}</span>,
    },
    {
      key: "email",
      header: "Email",
      cell: (row) => <span className="text-muted-foreground">{row.email}</span>,
    },
    {
      key: "role",
      header: "Rôle",
      cell: (row) => (
        <span className="text-muted-foreground">{roleLabel(row.role)}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Créé le",
      cell: (row) => (
        <span className="text-muted-foreground">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-px whitespace-nowrap text-center",
      cell: (row) => (
        <div className="inline-flex justify-center gap-1">
          <button
            type="button"
            title="Modifier"
            aria-label="Modifier"
            onClick={() => setDialog({ kind: "edit", user: row })}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            title={
              row.id === currentUserId
                ? "Vous ne pouvez pas supprimer votre propre compte"
                : "Supprimer"
            }
            aria-label="Supprimer"
            disabled={row.id === currentUserId}
            onClick={() => setDialog({ kind: "delete", user: row })}
            className="grid size-8 place-items-center rounded-lg text-danger-foreground transition-colors hover:bg-danger disabled:cursor-not-allowed disabled:text-muted-foreground/30 disabled:hover:bg-transparent"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  function renderMobileCard(row: User) {
    return (
      <div className="rounded-xl border border-border p-3.5">
        <div className="font-medium text-foreground">{nameCell(row)}</div>
        <dl className="mt-2.5 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="min-w-0 truncate text-foreground">{row.email}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Rôle</dt>
            <dd className="text-foreground">{roleLabel(row.role)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Créé le</dt>
            <dd className="text-foreground">{formatDate(row.createdAt)}</dd>
          </div>
        </dl>
        <div className="mt-3 flex justify-end gap-2 border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={() => setDialog({ kind: "edit", user: row })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
          >
            <Pencil className="size-3.5" /> Modifier
          </button>
          <button
            type="button"
            disabled={row.id === currentUserId}
            onClick={() => setDialog({ kind: "delete", user: row })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-danger-foreground/25 px-3 py-1.5 text-xs text-danger-foreground disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:opacity-50"
          >
            <Trash2 className="size-3.5" /> Supprimer
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <DataTable<User>
        title="Utilisateurs"
        action={
          <Button size="sm" onClick={() => setDialog({ kind: "create" })}>
            <Plus className="size-4" /> Nouvel utilisateur
          </Button>
        }
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
      />

      <UserFormDialog
        open={dialog.kind === "create" || dialog.kind === "edit"}
        user={dialog.kind === "edit" ? dialog.user : null}
        isSelf={dialog.kind === "edit" && dialog.user.id === currentUserId}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "closed" });
        }}
        onSuccess={closeAndRefresh}
      />

      <DeleteUserDialog
        open={dialog.kind === "delete"}
        user={dialog.kind === "delete" ? dialog.user : null}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "closed" });
        }}
        onSuccess={closeAndRefresh}
      />
    </>
  );
}
