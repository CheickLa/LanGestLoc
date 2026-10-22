"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import type { components } from "@/lib/api/schema";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatGNF } from "@/lib/format";
import { monthLabel, monthOf } from "@/lib/months";
import { PAYMENT_METHOD_LABEL, contractLabel, paymentPeriod } from "@/lib/payments";
import { PdfLink } from "@/components/pdf-link";

type PayableMonth = components["schemas"]["PayableMonthEntity"];
type PaymentDetail = components["schemas"]["PaymentDetailEntity"];
type CreatePayment = components["schemas"]["CreatePaymentDto"];

export type PaymentContract = { id: number; label: string };

type PaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & (
  | { contracts: PaymentContract[]; contract?: undefined }
  | { contract: PaymentContract; contracts?: undefined }
);

const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  contractId: z.string().min(1, "Le contrat est requis."),
  untilMonth: z.string().min(1, "Choisissez le dernier mois à solder."),
  paymentMethod: z.enum(["CASH", "ORANGE_MONEY", "MOBILE_MONEY"]),
  paymentDate: z
    .string()
    .min(1, "La date est requise.")
    .refine((d) => d <= today(), "La date ne peut pas être dans le futur."),
});
type Values = z.infer<typeof schema>;

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function readError(response: Response, fallback: string): Promise<RequestError> {
  const data = (await response.json().catch(() => null)) as { message?: string } | null;
  return new RequestError(data?.message ?? fallback, response.status);
}

async function fetchPayableMonths(contractId: string): Promise<PayableMonth[]> {
  const response = await fetch(`/api/contracts/${contractId}/payable-months`);
  if (!response.ok) throw await readError(response, "Impossible de charger les mois à payer.");
  return response.json();
}

async function createPayment(body: CreatePayment): Promise<PaymentDetail> {
  const response = await fetch("/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await readError(response, "Paiement impossible.");
  return response.json();
}

const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

export function PaymentDialog({ open, onOpenChange, contract, contracts }: PaymentDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fixedContractId = contract ? String(contract.id) : "";
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      contractId: contract ? String(contract.id) : "",
      untilMonth: "",
      paymentMethod: "CASH",
      paymentDate: today(),
    },
  });

  const contractId = useWatch({ control: form.control, name: "contractId" });
  const untilMonth = useWatch({ control: form.control, name: "untilMonth" });

  const payable = useQuery({
    queryKey: ["payable-months", contractId],
    queryFn: () => fetchPayableMonths(contractId),
    enabled: open && contractId !== "",
  });
  const months = payable.data;

  const mutation = useMutation({
    mutationFn: createPayment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payable-months"] });
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      if (error instanceof RequestError && error.status === 409) void payable.refetch();
    },
  });
  const { reset: resetMutation } = mutation;

  useEffect(() => {
    if (open) {
      form.reset({
        contractId: fixedContractId,
        untilMonth: "",
        paymentMethod: "CASH",
        paymentDate: today(),
      });
      resetMutation();
    }
  }, [open, form, fixedContractId, resetMutation]);

  // Mois par défaut : le dernier qui n'est pas à l'avance.
  useEffect(() => {
    if (!months || months.some((m) => monthOf(m.month) === untilMonth)) return;
    const fallback = months.findLast((m) => m.status !== "ADVANCE");
    form.setValue("untilMonth", fallback ? monthOf(fallback.month) : "");
  }, [months, untilMonth, form]);

  const chosenIndex = months ? months.findIndex((m) => monthOf(m.month) === untilMonth) : -1;
  const covered = months && chosenIndex >= 0 ? months.slice(0, chosenIndex + 1) : [];
  const total = covered.reduce((sum, m) => sum + m.amount, 0);
  const nothingDue = !!months && months.length > 0 && months.every((m) => m.status === "ADVANCE");

  function onSubmit(values: Values) {
    mutation.mutate({
      contractId: Number(values.contractId),
      untilMonth: values.untilMonth,
      amount: total,
      paymentDate: values.paymentDate,
      paymentMethod: values.paymentMethod,
    });
  }

  const done = mutation.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {done ? (
          <div className="flex flex-col gap-4">
            <DialogHeader className="items-center text-center">
              <span className="grid size-12 place-items-center rounded-full bg-success text-success-foreground">
                <Check className="size-6" />
              </span>
              <DialogTitle>Paiement enregistré</DialogTitle>
              <DialogDescription className="sr-only">
                Récapitulatif du paiement enregistré.
              </DialogDescription>
            </DialogHeader>
            <p className="text-center text-2xl font-semibold tabular-nums">
              {formatGNF(done.amount)}
            </p>
            <dl className="flex flex-col gap-1.5 border-t pt-3 text-sm">
              <SummaryRow label="Contrat" value={contractLabel(done.contract)} />
              <SummaryRow label="Mois" value={paymentPeriod(done)} />
              <SummaryRow label="Moyen" value={PAYMENT_METHOD_LABEL[done.paymentMethod]} />
              <SummaryRow label="Date" value={formatDate(done.paymentDate)} />
            </dl>
            {done.receipt ? (
              <Button asChild>
                <PdfLink
                  href={`/api/receipts/by-payment/${done.id}`}
                >
                  Ouvrir le reçu
                </PdfLink>
              </Button>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Le reçu n&apos;a pas pu être généré.
              </p>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nouveau paiement</DialogTitle>
              <DialogDescription>
                {contract ? `${contract.label}. ` : ""}Le reçu PDF est généré automatiquement.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                {contracts ? (
                  <FormField
                    control={form.control}
                    name="contractId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contrat</FormLabel>
                        <FormControl>
                          <Combobox
                            options={contracts.map((c) => ({
                              value: String(c.id),
                              label: c.label,
                            }))}
                            value={field.value}
                            onChange={(value) => {
                              field.onChange(value);
                              form.setValue("untilMonth", "");
                            }}
                            placeholder="Choisir un contrat"
                            searchPlaceholder="Rechercher un contrat…"
                            emptyText="Aucun contrat actif."
                            disabled={mutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                {contractId !== "" ? (
                  <FormField
                    control={form.control}
                    name="untilMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Solder jusqu&apos;à</FormLabel>
                        <FormControl>
                          <select
                            className={selectClass}
                            disabled={mutation.isPending || !months || months.length === 0}
                            {...field}
                          >
                            <option value="" disabled>
                              Choisir un mois
                            </option>
                            {months?.map((m) => {
                              const ym = monthOf(m.month);
                              return (
                                <option key={ym} value={ym}>
                                  {monthLabel(ym)}
                                  {m.status === "ADVANCE" ? " (à l'avance)" : ""}
                                </option>
                              );
                            })}
                          </select>
                        </FormControl>
                        {payable.isPending ? (
                          <FormDescription>Chargement des mois…</FormDescription>
                        ) : payable.isError ? (
                          <p className="text-sm text-danger-foreground">
                            Impossible de charger les mois à payer.
                          </p>
                        ) : months && months.length === 0 ? (
                          <FormDescription>Aucun mois à payer pour ce contrat.</FormDescription>
                        ) : (
                          <FormDescription>
                            {nothingDue
                              ? "Aucun mois dû : les mois proposés sont à l'avance."
                              : "Du plus ancien mois dû jusqu'à celui-ci, sans en sauter."}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                {covered.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border">
                    <ul className="max-h-[228px] overflow-y-auto">
                      {covered.map((m) => (
                        <li
                          key={m.month}
                          className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm last:border-b-0"
                        >
                          <div className="flex flex-col items-start gap-1">
                            <span>{monthLabel(monthOf(m.month))}</span>
                            <StatusBadge status={m.status} />
                          </div>
                          <span className="whitespace-nowrap tabular-nums">
                            {formatGNF(m.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between gap-2 border-t bg-muted px-3 py-2.5 text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Lock className="size-3.5" />
                        Total · {covered.length} mois
                      </span>
                      <span className="whitespace-nowrap font-semibold tabular-nums">
                        {formatGNF(total)}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Moyen</FormLabel>
                        <FormControl>
                          <select
                            className={selectClass}
                            disabled={mutation.isPending}
                            {...field}
                          >
                            {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            max={today()}
                            disabled={mutation.isPending}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={mutation.isPending}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={mutation.isPending || payable.isFetching || covered.length === 0}>
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="animate-spin" /> Enregistrement…
                      </>
                    ) : (
                      `Enregistrer ${formatGNF(total)}`
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
