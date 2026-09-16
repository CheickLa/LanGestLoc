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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  paymentDate: z.string().min(1, "La date de restitution est requise."),
  paymentMethod: z.enum(["CASH", "ORANGE_MONEY", "MOBILE_MONEY"]),
});
type Values = z.infer<typeof schema>;

async function cancel(contractId: number, values: Values): Promise<void> {
  const response = await fetch(`/api/contracts/${contractId}/cancel`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(
      data?.message ??
        (response.status === 409
          ? "L'annulation est impossible : un paiement de loyer existe déjà."
          : "Annulation impossible."),
    );
  }
}

export function CancelContractDialog({
  open,
  onOpenChange,
  contractId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: number;
}) {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { paymentDate: "", paymentMethod: "CASH" },
  });

  useEffect(() => {
    if (open) form.reset({ paymentDate: "", paymentMethod: "CASH" });
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: (values: Values) => cancel(contractId, values),
    onSuccess: () => {
      toast.success("Contrat annulé.");
      onOpenChange(false);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler le contrat</DialogTitle>
          <DialogDescription>
            La caution est restituée au locataire à l&apos;annulation.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-danger-foreground/25 bg-danger/40 px-3 py-2 text-sm text-danger-foreground">
          L&apos;annulation n&apos;est possible que si aucun loyer n&apos;a été payé. La
          caution est restituée.
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="flex flex-col gap-4"
          >
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
                Retour
              </Button>
              <Button type="submit" variant="destructive" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin" /> Annulation…
                  </>
                ) : (
                  "Annuler le contrat"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
