import { formatGNF } from "@/lib/format";
import { monthLabel, monthShortLabel } from "@/lib/months";
import { cn } from "@/lib/utils";

import { COLLECTED_BY_MONTH, CURRENT_MONTH_INDEX, DASHBOARD, REGISTER_MONTHS } from "./demo-data";

const compact = (n: number) =>
  new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const monthName = (ym: string) => monthLabel(ym).replace(/ \d{4}$/, "");

const maxCollected = Math.max(...COLLECTED_BY_MONTH.map((m) => m.amount));

function Kpi({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.4cqi] bg-background px-[1.8cqi] py-[1.6cqi]">
      <div className="text-[1.35cqi] text-muted-foreground">{label}</div>
      <div className="text-[3cqi] font-bold tracking-[-0.02em]">{value}</div>
      {children}
    </div>
  );
}

export function DashboardPreview() {
  const late = DASHBOARD.late[0];

  return (
    <div className="@container h-full">
      <div className="flex h-full flex-col gap-[2cqi] px-[3.4cqi] py-[3cqi] text-[1.6cqi] leading-[1.35] text-foreground">
        <div className="flex items-center justify-between">
          <span className="text-[2.8cqi] font-bold tracking-[-0.02em]">Tableau de bord</span>
          <span className="rounded-full border border-foreground/10 bg-background px-[1.4cqi] py-[0.4cqi] text-[1.4cqi] text-muted-foreground capitalize">
            {monthLabel(REGISTER_MONTHS[CURRENT_MONTH_INDEX])}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-[1.4cqi]">
          <Kpi label="Contrats actifs" value={String(DASHBOARD.activeContracts)}>
            <div className="text-[1.25cqi] text-muted-foreground">sur {DASHBOARD.locals} boutiques</div>
          </Kpi>
          <Kpi label="Encaissé ce mois" value={compact(DASHBOARD.collected)}>
            <div className="text-[1.25cqi] text-muted-foreground">GNF, {DASHBOARD.payments} paiements</div>
          </Kpi>
          <Kpi label="Loyers en retard" value={String(DASHBOARD.late.length)}>
            <div className="flex items-center gap-[0.6cqi] text-[1.25cqi] text-danger-foreground">
              <span className="size-[1cqi] rounded-full bg-danger-foreground" />
              {late.row.code}, {monthName(late.month)}
            </div>
          </Kpi>
          <Kpi label="Recouvrement" value={`${DASHBOARD.recovery} %`}>
            <div className="mt-[0.6cqi] h-[0.8cqi] overflow-hidden rounded-full bg-primary/15">
              <div className="h-full rounded-full bg-primary" style={{ width: `${DASHBOARD.recovery}%` }} />
            </div>
          </Kpi>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.3fr] gap-[1.4cqi]">
          <div className="flex min-w-0 flex-col gap-[1.2cqi] rounded-[1.4cqi] bg-background px-[2cqi] py-[1.8cqi]">
            <div className="font-semibold">Échéances de {monthName(REGISTER_MONTHS[CURRENT_MONTH_INDEX])}</div>
            <div className="flex h-[2cqi] gap-[2px]">
              <div className="rounded-l-[0.5cqi] bg-chart-paid" style={{ flex: DASHBOARD.duesPaid }} />
              <div className="rounded-r-[0.5cqi] bg-chart-pending" style={{ flex: DASHBOARD.duesPending }} />
            </div>
            <div className="flex flex-col gap-[0.6cqi] text-[1.4cqi]">
              {[
                { label: "Payées", count: DASHBOARD.duesPaid, swatch: "bg-chart-paid" },
                { label: "En attente", count: DASHBOARD.duesPending, swatch: "bg-chart-pending" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="flex items-center gap-[0.8cqi]">
                    <span className={cn("size-[1.2cqi] rounded-[0.3cqi]", item.swatch)} />
                    {item.label}
                  </span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto rounded-[1cqi] bg-danger px-[1.2cqi] py-[1cqi] text-[1.35cqi] text-danger-foreground">
              <span className="font-semibold">En retard :</span> {late.row.code}, {monthName(late.month)},{" "}
              {formatGNF(late.row.rent)}
            </div>
          </div>

          <div className="flex min-w-0 flex-col rounded-[1.4cqi] bg-background px-[2cqi] py-[1.8cqi]">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Encaissé par mois</span>
              <span className="text-[1.3cqi] text-muted-foreground">millions de GNF</span>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-6 items-end gap-[1.4cqi] pt-[3cqi]">
              {COLLECTED_BY_MONTH.map((m, i) => {
                const current = i === COLLECTED_BY_MONTH.length - 1;
                return (
                  <div key={m.month} className="flex h-full flex-col items-center justify-end gap-[0.6cqi]">
                    <span className={cn("text-[1.35cqi] font-semibold", !current && "invisible")}>
                      {(m.amount / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1 })}
                    </span>
                    <div
                      className={cn("w-full rounded-t-[0.6cqi]", current ? "bg-primary" : "bg-primary/25")}
                      style={{ height: `${Math.round((m.amount / maxCollected) * 78)}%` }}
                    />
                    <span className="text-[1.25cqi] text-muted-foreground">{monthShortLabel(m.month)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
