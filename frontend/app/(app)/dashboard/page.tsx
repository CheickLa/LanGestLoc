import { CircleAlert, FileText, TrendingUp, Wallet } from "lucide-react";

import type { components } from "@/lib/api/schema";
import { backendFetch, backendFetchPage } from "@/lib/api/server";
import { formatNumber } from "@/lib/format";
import { monthLabel, monthOf, ofMonthLabel } from "@/lib/months";

import { CollectedChart } from "./collected-chart";
import { CurrentDuesCard } from "./current-dues-card";
import { KpiCard } from "./kpi-card";
import { LateRentsCard } from "./late-rents-card";

type Dashboard = components["schemas"]["DashboardEntity"];
type LateContract = components["schemas"]["DashboardLateContractEntity"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string }>;
}) {
  // Seul `skip` est relayé : la route des retards n'accepte pas de recherche.
  const { skip } = await searchParams;
  const [data, { data: lateContracts }] = await Promise.all([
    backendFetch<Dashboard>("/dashboard"),
    backendFetchPage<LateContract>("/dashboard/late-contracts", { skip }, "/dashboard"),
  ]);
  const month = monthOf(data.month);
  const { collected, contracts, late, recoveryRate } = data;
  const lateLocals = lateContracts.total;

  return (
    <div className="flex flex-col gap-3 xl:gap-4">
      <h2 className="text-lg font-semibold capitalize">{monthLabel(month)}</h2>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <KpiCard
          icon={Wallet}
          label="Encaissé ce mois"
          value={
            <>
              {formatNumber(collected.amount)}
              <span className="text-[13px] font-medium tracking-normal text-muted-foreground md:text-[15px]">
                {" "}
                GNF
              </span>
            </>
          }
          sub={
            <>
              {collected.payments} {collected.payments < 2 ? "paiement" : "paiements"}
              <span className="hidden md:inline">
                {collected.payments < 2 ? " enregistré" : " enregistrés"}
              </span>
            </>
          }
        />
        <KpiCard
          icon={FileText}
          label="Contrats actifs"
          value={contracts.active}
          sub={`sur ${contracts.locals} ${contracts.locals < 2 ? "local" : "locaux"}`}
        />
        <KpiCard
          icon={CircleAlert}
          label="Loyers en retard"
          value={late.count}
          tone={late.count > 0 ? "danger" : undefined}
          sub={
            late.count > 0
              ? `sur ${lateLocals} ${lateLocals < 2 ? "local" : "locaux"}`
              : "Tout est à jour"
          }
        />
        <KpiCard
          icon={TrendingUp}
          label="Recouvrement"
          value={recoveryRate === null ? "—" : `${recoveryRate} %`}
          sub={
            <>
              <span className="hidden md:inline">des loyers </span>
              {ofMonthLabel(month)} payés
            </>
          }
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_1.5fr] xl:gap-4">
        <CurrentDuesCard month={month} dueDate={data.dueDate} dues={data.currentDues} />
        <CollectedChart months={data.monthly} />
      </div>

      <LateRentsCard late={late} contracts={lateContracts} />
    </div>
  );
}
