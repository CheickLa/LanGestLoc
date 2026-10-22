import Image from "next/image";
import { ChevronDown } from "lucide-react";

import { StatusBadge, type Status } from "@/components/ui/status-badge";
import { navItemsForRole } from "@/components/layout/nav-items";
import { formatGNF } from "@/lib/format";
import { cn } from "@/lib/utils";

// Reproduction de l'écran « Nouveau paiement » (components/payments/payment-dialog.tsx).

const MONTHS: { label: string; status: Status }[] = [
  { label: "octobre 2026", status: "PENDING" },
  { label: "novembre 2026", status: "ADVANCE" },
  { label: "décembre 2026", status: "ADVANCE" },
];

const RENT = 2_000_000;
const TOTAL = RENT * MONTHS.length;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 font-semibold">{label}</div>
      <div className="flex h-[34px] items-center justify-between rounded-lg border border-border px-2.5">{children}</div>
    </div>
  );
}

export function PhonePreview() {
  return (
    <div
      role="img"
      aria-label="LanGestLoc sur un téléphone : l'écran Nouveau paiement"
      className="flex aspect-[9/19] w-[min(300px,100%)] flex-col overflow-hidden rounded-[46px] border-10 border-foreground bg-muted shadow-[var(--screen-shadow)]"
    >
      <div aria-hidden className="flex h-[58px] shrink-0 items-center gap-2.5 bg-primary px-3.5 text-primary-foreground">
        <Image src="/icon-white.svg" alt="" width={26} height={26} className="size-[26px]" />
        <span className="text-base font-semibold">Paiements</span>
      </div>
      <div aria-hidden className="mx-2 mt-2.5 flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden rounded-t-2xl bg-background px-3.5 py-4 text-xs">
        <div>
          <div className="text-base font-semibold">Nouveau paiement</div>
          <div className="text-muted-foreground">Boutique A2. Le reçu PDF est généré automatiquement.</div>
        </div>
        <div>
          <Field label="Solder jusqu'à">
            <span>décembre 2026</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Field>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Du plus ancien mois dû jusqu&apos;à celui-ci, sans en sauter.
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          {MONTHS.map((month) => (
            <div key={month.label} className="flex items-center justify-between border-b border-border px-2.5 py-1.5">
              <span className="flex flex-col items-start gap-0.5">
                <span>{month.label}</span>
                <StatusBadge status={month.status} className="px-1.5 py-0 text-[10px]" />
              </span>
              <span>{formatGNF(RENT)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-muted px-2.5 py-2">
            <span className="text-muted-foreground">Total, {MONTHS.length} mois</span>
            <span className="font-semibold">{formatGNF(TOTAL)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Moyen">Orange Money</Field>
          <Field label="Date">01/10/2026</Field>
        </div>
        <div className="mt-auto flex h-[42px] items-center justify-center rounded-[9px] bg-primary text-[13px] font-semibold text-primary-foreground">
          Enregistrer {formatGNF(TOTAL)}
        </div>
      </div>
      <div aria-hidden className="shrink-0 px-2 pt-1.5 pb-3">
        <div className="flex rounded-full border border-border bg-card p-1 shadow-[var(--card-shadow)]">
          {navItemsForRole("USER").map((item) => {
            const active = item.href === "/payments";
            const Icon = item.icon;
            return (
              <span
                key={item.href}
                className={cn(
                  "flex h-9 flex-1 items-center justify-center rounded-full",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4.5" strokeWidth={1.8} />
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
