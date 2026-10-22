import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-background p-4 shadow-[var(--card-shadow)] md:p-5">
      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground md:gap-2">
        <Icon className="size-[15px] shrink-0 md:size-4" strokeWidth={1.8} aria-hidden />
        {label}
      </div>
      <div
        className={cn(
          "mt-2 text-[22px] leading-[1.15] font-semibold tracking-[-0.02em] tabular-nums md:mt-2.5 md:text-[26px]",
          tone === "danger" && "text-danger-foreground",
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[13px] text-muted-foreground md:mt-1.5">{sub}</div>
    </div>
  );
}
