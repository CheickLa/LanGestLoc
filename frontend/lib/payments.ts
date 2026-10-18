import type { components } from "@/lib/api/schema";
import { monthOf, periodLabel } from "@/lib/months";

type PaymentEntity = components["schemas"]["PaymentWithLinesEntity"];

export const PAYMENT_METHOD_LABEL: Record<PaymentEntity["paymentMethod"], string> = {
  CASH: "Espèces",
  ORANGE_MONEY: "Orange Money",
  MOBILE_MONEY: "Mobile Money",
};

export const PAYMENT_TYPE_LABEL: Record<PaymentEntity["type"], string> = {
  RENT: "Loyer",
  DEPOSIT_HELD: "Caution",
  DEPOSIT_REFUND: "Restitution caution",
};

export function paymentPeriod(payment: {
  paymentLines: { rentDue: { month: string } }[];
}): string {
  return periodLabel(payment.paymentLines.map((l) => monthOf(l.rentDue.month)));
}

export function contractLabel(contract: {
  local: { name: string };
  tenant: { name: string };
}): string {
  return `${contract.local.name} · ${contract.tenant.name}`;
}
