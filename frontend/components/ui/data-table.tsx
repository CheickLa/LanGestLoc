"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: ReactNode;
  icon?: LucideIcon;
  cell: (row: T) => ReactNode;
  className?: string;
};

export type DataTableProps<T> = {
  title: string;
  action?: ReactNode;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  columns: Column<T>[];
  data: T[];
  getRowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  renderMobileCard: (row: T) => ReactNode;
  pagination?: {
    total: number;
    skip: number;
    take: number;
    onPageChange: (nextSkip: number) => void;
  };
  emptyState?: ReactNode;
};

export function HeaderLabel({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  if (!Icon) return children;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-[13px] shrink-0" strokeWidth={1.8} aria-hidden />
      {children}
    </span>
  );
}

export function DataTable<T>({
  title,
  action,
  search,
  columns,
  data,
  getRowKey,
  onRowClick,
  renderMobileCard,
  pagination,
  emptyState,
}: DataTableProps<T>) {
  const isEmpty = data.length === 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--card-shadow)]">
      {/* Titre pour les lecteurs d'écran : le titre visible est hors de la table */}
      <h2 className="sr-only">{title}</h2>

      {/* Barre d'outils : recherche + action principale */}
      {search || action ? (
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-5">
          {search ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus-within:border-primary md:max-w-sm">
              <Search className="size-4 shrink-0" />
              <input
                type="search"
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder={search.placeholder ?? "Rechercher…"}
                className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}

      {/* Desktop : table */}
      <div className="hidden overflow-x-auto md:block">
        {isEmpty ? (
          <div className="px-5 py-12">{emptyState}</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "border-y border-border bg-muted/60 px-5 py-2.5 text-left text-[11px] font-normal uppercase tracking-wide text-faint",
                      column.className,
                    )}
                  >
                    <HeaderLabel icon={column.icon}>{column.header}</HeaderLabel>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    "transition-colors last:border-0 hover:bg-muted/40",
                    onRowClick && "cursor-pointer focus-visible:bg-muted/40",
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "border-b border-border/60 px-5 py-3 align-middle text-foreground",
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile : cartes */}
      <div className="md:hidden">
        {isEmpty ? (
          <div className="px-4 py-12">{emptyState}</div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {data.map((row) => (
              <div key={getRowKey(row)}>{renderMobileCard(row)}</div>
            ))}
          </div>
        )}
      </div>

      {/* Pied : pagination */}
      {pagination && !isEmpty ? (
        <PaginationFooter {...pagination} />
      ) : null}
    </div>
  );
}

function PaginationFooter({
  total,
  skip,
  take,
  onPageChange,
}: NonNullable<DataTableProps<unknown>["pagination"]>) {
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(skip + take, total);
  const hasPrev = skip > 0;
  const hasNext = skip + take < total;

  return (
    <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground md:px-5">
      <span>
        {from}–{to} sur {total}
      </span>
      <div className="flex gap-1.5">
        <button
          type="button"
          aria-label="Page précédente"
          disabled={!hasPrev}
          onClick={() => onPageChange(Math.max(0, skip - take))}
          className="grid size-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Page suivante"
          disabled={!hasNext}
          onClick={() => onPageChange(skip + take)}
          className="grid size-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
