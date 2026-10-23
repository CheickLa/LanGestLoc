"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

import { tenantSchema, type TenantValues } from "./tenant-schema";

type TenantListItem = components["schemas"]["TenantListItemEntity"];

async function submitTenant(
  tenantId: number | null,
  values: TenantValues,
): Promise<void> {
  const payload = {
    ...values,
    activity: values.activity?.trim() ? values.activity.trim() : undefined,
  };

  const response = await fetch(
    tenantId ? `/api/tenants/${tenantId}` : "/api/tenants",
    {
      method: tenantId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(
      data?.message ??
        (response.status === 409
          ? "Un locataire avec ce téléphone ou cette pièce d'identité existe déjà."
          : "Enregistrement impossible. Réessayez."),
    );
  }
}

export function TenantFormDialog({
  open,
  tenant,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  tenant: TenantListItem | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const isEdit = tenant !== null;

  const form = useForm<TenantValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      name: "",
      activity: "",
      phone: "",
      dateOfBirth: "",
      birthPlace: "",
      idNumber: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: tenant?.name ?? "",
        activity: tenant?.activity ?? "",
        phone: tenant?.phone ?? "",
        dateOfBirth: tenant?.dateOfBirth ? tenant.dateOfBirth.slice(0, 10) : "",
        birthPlace: tenant?.birthPlace ?? "",
        idNumber: tenant?.idNumber ?? "",
      });
    }
  }, [open, tenant, form]);

  const mutation = useMutation({
    mutationFn: (values: TenantValues) =>
      submitTenant(tenant?.id ?? null, values),
    onSuccess: () => {
      toast.success(isEdit ? "Locataire mis à jour." : "Locataire créé.");
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
          <DialogTitle>
            {isEdit ? "Modifier le locataire" : "Nouveau locataire"}
          </DialogTitle>
          <DialogDescription>
            Renseigne les informations du locataire.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Aminata Barry"
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
              name="activity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Activité{" "}
                    <span className="text-muted-foreground">(optionnel)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Commerçant"
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
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+224 612 34 56 78"
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
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de naissance</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
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
              name="birthPlace"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lieu de naissance</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Conakry"
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
              name="idNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pièce d&apos;identité</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Numéro de la pièce"
                      autoComplete="off"
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
