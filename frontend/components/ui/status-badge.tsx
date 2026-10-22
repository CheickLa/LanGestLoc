import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";


type Schemas = components["schemas"];

type Status =
  | Schemas["ContractEntity"]["status"]
  | Schemas["RentDueEntity"]["status"]
  | Schemas["DepositEntity"]["status"]
  | Schemas["LocalListItemEntity"]["status"]
  | Schemas["PayableMonthEntity"]["status"];

type Variant = "success" | "danger" | "info" | "warning" | "neutral" | "outline";

const STATUS_MAP: Record<Status, { label: string; variant: Variant }> = {
  ACTIVE: { label: "Actif", variant: "success" },
  TERMINATED: { label: "Résilié", variant: "neutral" },
  CANCELED: { label: "Annulé", variant: "danger" },
  PENDING: { label: "En attente", variant: "info" },
  PAID: { label: "Payé", variant: "success" },
  LATE: { label: "En retard", variant: "danger" },
  HELD: { label: "Détenue", variant: "warning" },
  REFUNDED: { label: "Restituée", variant: "neutral" },
  OCCUPIED: { label: "Occupé", variant: "success" },
  VACANT: { label: "Vacant", variant: "warning" },
  ADVANCE: { label: "À l'avance", variant: "outline" },
};

const VARIANT_CLASSES: Record<Variant, string> = {
  success: "bg-success text-success-foreground",
  danger: "bg-danger text-danger-foreground",
  info: "bg-info text-info-foreground",
  warning: "bg-warning text-warning-foreground",
  neutral: "bg-neutral text-neutral-foreground",
  // Contour à l'intérieur : même taille que les pastilles pleines.
  outline: "bg-background text-neutral-foreground ring-1 ring-inset ring-faint/50",
};

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const { label, variant } = STATUS_MAP[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}

export type { Status };
