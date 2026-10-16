"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { formatGNF } from "@/lib/format";
import { firstDayOf, monthLabel, monthOf, nextMonthOf } from "@/lib/months";

type Values = { amount: string; month: string };

async function increase(
  contractId: number,
  payload: { amount: number; effectiveFrom: string },
): Promise<void> {
  const response = await fetch("/api/rents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contractId, ...payload }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? "Augmentation impossible.");
  }
}

export function IncreaseRentDialog({
  open,
  onOpenChange,
  contractId,
  currentAmount,
  currentEffectiveFrom,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: number;
  currentAmount: number | null;
  currentEffectiveFrom: string | null;
}) {
  const router = useRouter();

  // Plus tôt possible : le mois qui suit celui du loyer actuel.
  const minMonth = currentEffectiveFrom ? nextMonthOf(currentEffectiveFrom) : null;
  const currentMonth = currentEffectiveFrom ? monthOf(currentEffectiveFrom) : null;

  // Schéma dépendant des props → reconstruit si le loyer actuel change.
  // Les erreurs s'affichent via <FormMessage>, comme dans les autres formulaires.
  const schema = useMemo(
    () =>
      z.object({
        amount: z
          .string()
          .min(1, "Le montant est requis.")
          .refine((v) => Number(v) > 0, "Le montant doit être positif.")
          .refine(
            (v) => currentAmount === null || Number(v) > currentAmount,
            currentAmount !== null
              ? `Le nouveau loyer doit dépasser le loyer actuel (${formatGNF(currentAmount)}).`
              : "Le nouveau loyer doit dépasser le loyer actuel.",
          ),
        month: z
          .string()
          .min(1, "Le mois d'effet est requis.")
          .refine(
            (v) => currentMonth === null || v > currentMonth,
            minMonth
              ? `L'augmentation doit prendre effet au plus tôt en ${monthLabel(minMonth)}.`
              : "Le mois d'effet doit suivre le loyer actuel.",
          ),
      }),
    [currentAmount, currentMonth, minMonth],
  );

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "", month: "" },
  });

  useEffect(() => {
    if (open) form.reset({ amount: "", month: "" });
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      increase(contractId, {
        amount: Number(values.amount),
        effectiveFrom: firstDayOf(values.month),
      }),
    onSuccess: () => {
      toast.success("Loyer augmenté.");
      onOpenChange(false);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Augmenter le loyer</DialogTitle>
          <DialogDescription>
            {currentAmount
              ? `Loyer actuel : ${formatGNF(currentAmount)}. L'augmentation prend effet au 1er du mois choisi ; un nouveau loyer est créé, l'ancien est clôturé.`
              : "L'augmentation prend effet au 1er du mois choisi ; un nouveau loyer est créé, l'ancien est clôturé."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nouveau montant (GNF)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={currentAmount !== null ? currentAmount + 1 : 1}
                      disabled={mutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="month"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mois d&apos;effet</FormLabel>
                  <FormControl>
                    <Input
                      type="month"
                      min={minMonth ?? undefined}
                      disabled={mutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin" /> Enregistrement…
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
