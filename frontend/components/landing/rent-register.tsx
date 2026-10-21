"use client";

import { useState } from "react";
import { Check, CircleAlert, Clock, type LucideIcon } from "lucide-react";

import { StatusBadge, type Status } from "@/components/ui/status-badge";
import { formatGNF } from "@/lib/format";
import { monthLabel, monthShortLabel } from "@/lib/months";
import { cn } from "@/lib/utils";

import {
  CURRENT_MONTH_INDEX,
  REGISTER_MONTHS,
  REGISTER_ROWS,
  type CellState,
  type RegisterRow,
} from "./demo-data";

type DueState = Exclude<CellState, "future" | "none">;

const DUE: Record<DueState, { status: Status; label: string; className: string; icon: LucideIcon; iconClassName: string }> = {
  paid: {
    status: "PAID",
    label: "payé",
    className: "bg-success",
    icon: Check,
    iconClassName: "text-success-foreground",
  },
  advance: {
    status: "PAID",
    label: "payé d'avance",
    className: "border-[1.5px] border-success-foreground/40 bg-background",
    icon: Check,
    iconClassName: "text-success-foreground",
  },
  pending: {
    status: "PENDING",
    label: "en attente",
    className: "bg-info",
    icon: Clock,
    iconClassName: "text-info-foreground",
  },
  late: {
    status: "LATE",
    label: "en retard",
    className: "bg-danger",
    icon: CircleAlert,
    iconClassName: "text-danger-foreground",
  },
};

const LEGEND: { label: string; className: string; icon?: LucideIcon; iconClassName?: string }[] = [
  { ...DUE.paid, label: "Payé" },
  { ...DUE.advance, label: "Payé d'avance" },
  { ...DUE.pending, label: "En attente" },
  { ...DUE.late, label: "En retard" },
  { label: "Pas encore d'échéance", className: "border border-dashed border-foreground/20" },
];

type Selection = { row: RegisterRow; month: number; state: DueState };

// B2 en septembre : la case en retard.
const INITIAL: Selection = { row: REGISTER_ROWS[5], month: 2, state: "late" };

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function RentRegister({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState(INITIAL);

  const { row } = selected;
  const due = DUE[selected.state];

  return (
    <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-14">
      <div className="min-w-0 flex-1">
        <div className="overflow-x-auto">
          <table className="w-full min-w-80 table-fixed border-separate border-spacing-1">
            <caption className="sr-only">Registre des loyers de juillet à décembre 2026, par boutique</caption>
            <colgroup>
              <col className="w-20 md:w-40" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="pb-1.5 text-left text-xs font-medium text-muted-foreground">
                  Boutique
                </th>
                {REGISTER_MONTHS.map((ym, i) => (
                  <th
                    key={ym}
                    scope="col"
                    className={cn(
                      "pb-1.5 text-center text-xs",
                      i === CURRENT_MONTH_INDEX ? "font-bold text-foreground" : "font-medium text-muted-foreground",
                    )}
                  >
                    {monthShortLabel(ym)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REGISTER_ROWS.map((r) => (
                <tr key={r.code}>
                  <th scope="row" className="min-w-0 text-left font-normal">
                    <span className="block text-[15px] leading-tight font-bold">{r.code}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.trade}</span>
                  </th>
                  {r.cells === null ? (
                    <td colSpan={REGISTER_MONTHS.length}>
                      <span className="flex h-11 items-center rounded-lg bg-neutral px-3.5 text-[13px] font-medium text-neutral-foreground">
                        Vacant : aucun contrat en cours
                      </span>
                    </td>
                  ) : (
                    r.cells.map((cell, i) => {
                      if (cell === "future" || cell === "none") {
                        return (
                          <td key={i}>
                            <span className="grid h-11 place-items-center rounded-lg border border-dashed border-foreground/15 text-[13px] text-faint">
                              <span aria-hidden>{cell === "none" ? "–" : ""}</span>
                              <span className="sr-only">{cell === "none" ? "Hors contrat" : "Pas encore d'échéance"}</span>
                            </span>
                          </td>
                        );
                      }
                      const { icon: Icon, ...cellDue } = DUE[cell];
                      const isSelected = selected.row === r && selected.month === i;
                      return (
                        <td key={i}>
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            aria-label={`${r.code}, ${monthLabel(REGISTER_MONTHS[i])} : ${cellDue.label}`}
                            onClick={() => setSelected({ row: r, month: i, state: cell })}
                            className={cn(
                              "grid h-11 w-full place-items-center rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring",
                              cellDue.className,
                              isSelected && "outline-2 outline-foreground",
                            )}
                          >
                            <Icon className={cn("size-4.5", cellDue.iconClassName)} strokeWidth={2.6} />
                          </button>
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-4.5 gap-y-2.5 text-[13px] text-foreground/80">
          {LEGEND.map(({ label, className, icon: Icon, iconClassName }) => (
            <li key={label} className="inline-flex items-center gap-1.5">
              <span className={cn("grid size-5 place-items-center rounded-[5px]", className)}>
                {Icon ? <Icon className={cn("size-3", iconClassName)} strokeWidth={3} /> : null}
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-7 lg:w-80 lg:shrink-0">
        <div aria-live="polite" className="rounded-2xl border border-border p-5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="text-lg leading-tight font-bold">
              {row.code}, {row.trade}
            </span>
            <StatusBadge status={due.status} />
          </div>
          <p className="mt-2.5 text-[15px] text-pretty">
            <strong className="font-semibold">{capitalize(monthLabel(REGISTER_MONTHS[selected.month]))} :</strong>{" "}
            {row.notes?.[selected.month] ?? `${due.label}.`}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">Loyer : {formatGNF(row.rent)} par mois</p>
        </div>
        {children}
      </div>
    </div>
  );
}
