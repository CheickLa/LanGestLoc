"use client";

import { useState } from "react";
import { ChartColumn } from "lucide-react";

import type { components } from "@/lib/api/schema";
import { formatGNF } from "@/lib/format";
import { monthLabel, monthOf, monthShortLabel, ofMonthLabel } from "@/lib/months";
import { cn } from "@/lib/utils";

type Monthly = components["schemas"]["DashboardEntity"]["monthly"];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function CollectedChart({ months }: { months: Monthly }) {
  const [active, setActive] = useState<number | null>(null);
  const current = months.length - 1;
  const shown = active ?? current;
  const max = Math.max(...months.map((m) => m.amount));
  const bars = months.map((m) => {
    const ym = monthOf(m.month);
    return {
      ym,
      label: capitalize(monthLabel(ym)),
      height: max > 0 ? (m.amount / max) * 100 : 0,
      amount: formatGNF(m.amount),
    };
  });
  const first = bars[0].ym;
  const last = bars[current].ym;
  const from = first.slice(0, 4) === last.slice(0, 4) ? ofMonthLabel(first) : `${ofMonthLabel(first)} ${first.slice(0, 4)}`;

  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-background p-4 shadow-[var(--card-shadow)] md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 md:gap-y-1">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <ChartColumn className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden />
          Encaissé par mois
        </h3>
        <span className="text-[13px] text-muted-foreground">6 derniers mois</span>
      </div>

      <div
        role="group"
        aria-label={`Encaissé par mois, ${from} à ${monthLabel(last)}`}
        className="grid h-[200px] grid-cols-6 gap-2.5 border-b border-border pt-[60px] md:h-[230px] md:gap-4 md:pt-[70px]"
      >
        {bars.map((bar, i) => (
          <div key={bar.ym} className="relative h-full">
            {i === shown ? (
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute z-10 rounded-lg bg-foreground px-2.5 py-1.5 text-xs leading-[1.35] whitespace-nowrap text-background",
                  i === 0 ? "left-0" : i === current ? "right-0" : "left-1/2 -translate-x-1/2",
                )}
                style={{ bottom: `calc(${bar.height}% + 8px)` }}
              >
                <div className="text-background/75">{bar.label}</div>
                <div className="font-semibold tabular-nums">{bar.amount}</div>
              </div>
            ) : null}
            {/* Le bouton couvre toute la colonne : une petite barre reste facile à toucher. */}
            <button
              type="button"
              aria-label={`${bar.label} : ${bar.amount}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onBlur={() => setActive(null)}
              className="flex h-full w-full cursor-pointer items-end rounded-t-[4px] outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span
                className={cn(
                  "block w-full rounded-t-[4px]",
                  i === current ? "bg-primary" : i === active ? "bg-primary/50" : "bg-primary/25",
                )}
                style={{ height: `${bar.height}%` }}
              />
            </button>
          </div>
        ))}
      </div>

      <div aria-hidden className="grid grid-cols-6 gap-2.5 md:gap-4">
        {bars.map((bar, i) => (
          <span
            key={bar.ym}
            className={cn(
              "text-center text-xs",
              i === shown ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {monthShortLabel(bar.ym)}
          </span>
        ))}
      </div>
    </section>
  );
}
