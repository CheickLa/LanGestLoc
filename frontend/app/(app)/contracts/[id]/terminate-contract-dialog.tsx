"use client";

import { useEffect } from "react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { lastDayOf, monthLabel, monthOf, monthRange } from "@/lib/months";

const schema = z.object({
  lastMonth: z.string().min(1, "Le dernier mois est requis."),
  paymentDate: z.string().min(1, "La date de restitution est requise."),
  paymentMethod: z.enum(["CASH", "ORANGE_MONEY", "MOBILE_MONEY"]),
});
type Values = z.infer<typeof schema>;

// Le backend accepte toute fin de mois entre le début du contrat et le mois en cours, sans dépasser la fin prévue.
function lastMonthChoices(startDate: string, endDate: string | null): string[] {
  const current = monthOf(new Date());
  const last = endDate && monthOf(endDate) < current ? monthOf(endDate) : current;
  return monthRange(monthOf(startDate), last).reverse();
}

async function terminate(contractId: number, values: Values): Promise<void> {
  const response = await fetch(`/api/contracts/${contractId}/terminate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endDate: lastDayOf(values.lastMonth),
      paymentDate: values.paymentDate,
      paymentMethod: values.paymentMethod,
    }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(
      data?.message ??
        (response.status === 409
          ? "Des loyers restent impayés : réglez-les avant de résilier."
          : "Résiliation impossible."),
    );
  }
}

export function TerminateContractDialog({
  open,
  onOpenChange,
  contractId,
  startDate,
  endDate,
  onCancelInstead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: number;
  startDate: string;
  endDate: string | null;
  onCancelInstead: () => void;
}) {
  const router = useRouter();
  const choices = lastMonthChoices(startDate, endDate);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { lastMonth: "", paymentDate: "", paymentMethod: "CASH" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        lastMonth: lastMonthChoices(startDate, endDate)[0] ?? "",
        paymentDate: "",
        paymentMethod: "CASH",
      });
    }
  }, [open, form, startDate, endDate]);

  const mutation = useMutation({
    mutationFn: (values: Values) => terminate(contractId, values),
    onSuccess: () => {
      toast.success("Contrat résilié.");
      onOpenChange(false);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (choices.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Résilier le contrat</DialogTitle>
            <DialogDescription>
              Ce contrat ne commence qu&apos;en {monthLabel(monthOf(startDate))} : il ne peut
              pas encore être résilié. Pour y mettre fin, il faut l&apos;annuler, et la caution
              est remboursée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <Button type="button" onClick={onCancelInstead}>
              Annuler le contrat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Résilier le contrat</DialogTitle>
          <DialogDescription>
            La caution est restituée au locataire à la résiliation.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-danger-foreground/25 bg-danger/40 px-3 py-2 text-sm text-danger-foreground">
          Les loyers doivent être réglés jusqu&apos;au dernier mois inclus avant la
          résiliation. La caution est restituée au locataire.
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="lastMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dernier mois</FormLabel>
                  <FormControl>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      disabled={mutation.isPending}
                      {...field}
                    >
                      {choices.map((ym) => (
                        <option key={ym} value={ym}>
                          {monthLabel(ym)}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormDescription>Le mois choisi est dû en entier.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Restitution caution — date</FormLabel>
                    <FormControl>
                      <Input type="date" disabled={mutation.isPending} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Restitution caution — moyen</FormLabel>
                    <FormControl>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        disabled={mutation.isPending}
                        {...field}
                      >
                        <option value="CASH">Espèces</option>
                        <option value="ORANGE_MONEY">Orange Money</option>
                        <option value="MOBILE_MONEY">Mobile Money</option>
                      </select>
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
              <Button type="submit" variant="destructive" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin" /> Résiliation…
                  </>
                ) : (
                  "Résilier"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
