import { CalendarCheck } from "lucide-react";

import type { components } from "@/lib/api/schema";
import { formatGNF } from "@/lib/format";
import { ofMonthLabel } from "@/lib/months";
import { cn } from "@/lib/utils";

type CurrentDues = components["schemas"]["DashboardEntity"]["currentDues"];

const dayAndMonth = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function CurrentDuesCard({
  month,
  dueDate,
  dues,
}: {
  month: string;
  dueDate: string;
  dues: CurrentDues;
}) {
  const { paid, pending } = dues;
  const ofMonth = ofMonthLabel(month);
  const empty = paid.count + pending.count === 0;
  const rows = [
    { label: "Payés", swatch: "bg-chart-paid", ...paid },
    { label: "En attente", swatch: "bg-chart-pending", ...pending },
  ];

  return (
    <section className="flex min-w-0 flex-col gap-3.5 rounded-2xl border border-border bg-background p-4 shadow-[var(--card-shadow)] md:gap-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 md:gap-y-1">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CalendarCheck className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden />
          Loyers {ofMonth}
        </h3>
        {empty ? null : (
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {formatGNF(paid.amount + pending.amount)} attendus
          </span>
        )}
      </div>

      {empty ? (
        <p className="text-sm text-muted-foreground">Aucun loyer ce mois.</p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Loyers ${ofMonth} : ${paid.count} payé${paid.count < 2 ? "" : "s"} pour ${formatGNF(paid.amount)}, ${pending.count} en attente pour ${formatGNF(pending.amount)}`}
            className="flex h-3 gap-0.5 overflow-hidden rounded-[4px]"
          >
            {rows
              .filter((r) => r.amount > 0)
              .map((r) => (
                <div key={r.label} className={r.swatch} style={{ flex: r.amount }} />
              ))}
          </div>

          <div className="flex flex-col">
            {rows.map((r, i) => (
              <div
                key={r.label}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2.5 md:gap-4",
                  i > 0 && "border-t border-border",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-[3px]", r.swatch)} />
                  {r.label}
                </span>
                <span className="font-semibold tabular-nums">{r.count}</span>
                <span className="min-w-[108px] text-right text-muted-foreground tabular-nums md:min-w-[116px]">
                  {formatGNF(r.amount)}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-auto text-[13px] text-muted-foreground">
            Les loyers {ofMonth} peuvent être réglés jusqu&apos;au{" "}
            {dayAndMonth.format(new Date(dueDate))}.
          </p>
        </>
      )}
    </section>
  );
}
