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
  endDate: z.string().min(1, "La date de fin est requise."),
  paymentDate: z.string().min(1, "La date de restitution est requise."),
  paymentMethod: z.enum(["CASH", "ORANGE_MONEY", "MOBILE_MONEY"]),
});
type Values = z.infer<typeof schema>;

async function terminate(contractId: number, values: Values): Promise<void> {
  const response = await fetch(`/api/contracts/${contractId}/terminate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(
      data?.message ??
        (response.status === 409
          ? "Des loyers échus restent impayés : réglez-les avant de résilier."
          : "Résiliation impossible."),
    );
  }
}

export function TerminateContractDialog({
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
    defaultValues: { endDate: "", paymentDate: "", paymentMethod: "CASH" },
  });

  useEffect(() => {
    if (open) form.reset({ endDate: "", paymentDate: "", paymentMethod: "CASH" });
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: (values: Values) => terminate(contractId, values),
    onSuccess: () => {
      toast.success("Contrat résilié.");
      onOpenChange(false);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

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
          Tous les loyers échus doivent être réglés avant la résiliation. La caution est
          restituée au locataire.
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de fin du contrat</FormLabel>
                  <FormControl>
                    <Input type="date" disabled={mutation.isPending} {...field} />
                  </FormControl>
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
