"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
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
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { formatGNF } from "@/lib/format";
import { firstDayOf, isMonth, lastDayOf } from "@/lib/months";

type LocalListItem = components["schemas"]["LocalListItemEntity"];
type TenantListItem = components["schemas"]["TenantListItemEntity"];
type Contract = components["schemas"]["ContractEntity"];

const todayISO = () => new Date().toISOString().slice(0, 10);

// Les règles ci-dessous reflètent celles enforced côté backend (source de vérité) :
// mois de fin pas avant le mois de début, versement de la caution non daté dans le futur.
const schema = z
  .object({
    localId: z.string().min(1, "Sélectionne un local."),
    tenantId: z.string().min(1, "Sélectionne un locataire."),
    startMonth: z.string().refine(isMonth, "Choisis le mois de début (AAAA-MM)."),
    endMonth: z.string().optional(),
    rentAmount: z
      .string()
      .min(1, "Le loyer mensuel est requis.")
      .refine((v) => Number(v) > 0, "Le loyer doit être positif."),
    depositPaymentMethod: z.enum(["CASH", "ORANGE_MONEY", "MOBILE_MONEY"]),
    depositPaymentDate: z.string().min(1, "La date de versement est requise."),
  })
  .refine((d) => !d.endMonth || isMonth(d.endMonth), {
    message: "Choisis un mois de fin valide (AAAA-MM).",
    path: ["endMonth"],
  })
  .refine((d) => !d.endMonth || !isMonth(d.startMonth) || d.endMonth >= d.startMonth, {
    message: "Le mois de fin ne peut pas précéder le mois de début.",
    path: ["endMonth"],
  })
  .refine(
    (d) => !d.depositPaymentDate || d.depositPaymentDate <= todayISO(),
    {
      message: "Le versement de la caution ne peut pas être dans le futur.",
      path: ["depositPaymentDate"],
    },
  );

type Values = z.infer<typeof schema>;

async function createContract(values: Values): Promise<Contract> {
  const payload = {
    localId: Number(values.localId),
    tenantId: Number(values.tenantId),
    startDate: firstDayOf(values.startMonth),
    endDate: values.endMonth ? lastDayOf(values.endMonth) : undefined,
    rentAmount: Number(values.rentAmount),
    depositPaymentMethod: values.depositPaymentMethod,
    depositPaymentDate: values.depositPaymentDate,
  };

  const response = await fetch("/api/contracts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(
      data?.message ??
        (response.status === 409
          ? "Ce local a déjà un contrat actif."
          : "Création impossible. Vérifie les informations."),
    );
  }

  return (await response.json()) as Contract;
}

export function ContractFormDialog({
  open,
  onOpenChange,
  locals,
  tenants,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locals: LocalListItem[];
  tenants: TenantListItem[];
}) {
  const router = useRouter();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      localId: "",
      tenantId: "",
      startMonth: "",
      endMonth: "",
      rentAmount: "",
      depositPaymentMethod: "CASH",
      depositPaymentDate: "",
    },
  });

  useEffect(() => {
    if (open) form.reset();
  }, [open, form]);

  const rentAmount = useWatch({ control: form.control, name: "rentAmount" });

  const localOptions: ComboboxOption[] = locals.map((l) => ({
    value: String(l.id),
    label: l.name,
  }));
  const tenantOptions: ComboboxOption[] = tenants.map((t) => ({
    value: String(t.id),
    label: t.name,
    description: t.activity ?? undefined,
  }));

  const mutation = useMutation({
    mutationFn: createContract,
    onSuccess: (contract) => {
      toast.success("Contrat créé.");
      onOpenChange(false);
      router.push(`/contracts/${contract.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau contrat</DialogTitle>
          <DialogDescription>Renseigne le local, le locataire et la période du contrat.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="localId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local</FormLabel>
                  <FormControl>
                    <Combobox
                      options={localOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Local libre…"
                      searchPlaceholder="Rechercher un local…"
                      emptyText="Aucun local libre."
                      disabled={mutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tenantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Locataire</FormLabel>
                  <FormControl>
                    <Combobox
                      options={tenantOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Locataire…"
                      searchPlaceholder="Rechercher un locataire…"
                      emptyText="Aucun locataire."
                      disabled={mutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Début</FormLabel>
                    <FormControl>
                      <Input
                        type="month"
                        placeholder="AAAA-MM"
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
                name="endMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Fin <span className="text-muted-foreground">(optionnel)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="month"
                        placeholder="AAAA-MM"
                        disabled={mutation.isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="rentAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loyer mensuel (GNF)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="1500000"
                      disabled={mutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border border-warning/40 bg-warning/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Caution (1 mois de loyer) : </span>
              <span className="font-medium tabular-nums">
                {rentAmount && Number(rentAmount) > 0
                  ? formatGNF(Number(rentAmount))
                  : "—"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="depositPaymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Versement caution</FormLabel>
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
              <FormField
                control={form.control}
                name="depositPaymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date versement</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        max={todayISO()}
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
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin" /> Création…
                  </>
                ) : (
                  "Créer le contrat"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
