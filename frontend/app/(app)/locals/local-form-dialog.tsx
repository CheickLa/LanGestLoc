"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { components } from "@/lib/api/schema";
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

type LocalListItem = components["schemas"]["LocalListItemEntity"];

const localSchema = z.object({
  code: z
    .string()
    .regex(/^LOCAL-\d{3}$/, "Format attendu : LOCAL-XXX (3 chiffres)."),
  name: z.string().min(1, "Le nom est requis."),
});

type LocalValues = z.infer<typeof localSchema>;

async function submitLocal(
  localId: number | null,
  values: LocalValues,
): Promise<void> {
  const response = await fetch(
    localId ? `/api/locals/${localId}` : "/api/locals",
    {
      method: localId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    },
  );

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(
      data?.message ??
        (response.status === 409
          ? "Un local avec ce code existe déjà."
          : "Enregistrement impossible. Réessayez."),
    );
  }
}

export function LocalFormDialog({
  open,
  local,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  local: LocalListItem | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const isEdit = local !== null;

  const form = useForm<LocalValues>({
    resolver: zodResolver(localSchema),
    defaultValues: { code: "", name: "" },
  });

  // Réinitialiser le formulaire à chaque ouverture / changement de cible.
  useEffect(() => {
    if (open) {
      form.reset({ code: local?.code ?? "", name: local?.name ?? "" });
    }
  }, [open, local, form]);

  const mutation = useMutation({
    mutationFn: (values: LocalValues) => submitLocal(local?.id ?? null, values),
    onSuccess: () => {
      toast.success(isEdit ? "Local mis à jour." : "Local créé.");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le local" : "Nouveau local"}</DialogTitle>
          <DialogDescription>
            Renseigne le code (format LOCAL-XXX) et le nom du local.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="LOCAL-001"
                      autoComplete="off"
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Boutique Madina"
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
                    <Loader2 className="animate-spin" />
                    Enregistrement…
                  </>
                ) : isEdit ? (
                  "Enregistrer"
                ) : (
                  "Créer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
