"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { components } from "@/lib/api/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TenantListItem = components["schemas"]["TenantListItemEntity"];

async function deleteTenant(tenantId: number): Promise<void> {
  const response = await fetch(`/api/tenants/${tenantId}`, { method: "DELETE" });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(
      data?.message ??
        (response.status === 409
          ? "Impossible : des contrats sont associés à ce locataire."
          : "Suppression impossible. Réessayez."),
    );
  }
}

export function DeleteTenantDialog({
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
  const mutation = useMutation({
    mutationFn: (tenantId: number) => deleteTenant(tenantId),
    onSuccess: () => {
      toast.success("Locataire supprimé.");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce locataire ?</AlertDialogTitle>
          <AlertDialogDescription>
            {tenant
              ? `Le locataire « ${tenant.name} » sera définitivement supprimé. Cette action est irréversible.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            variant="danger"
            disabled={mutation.isPending || !tenant}
            onClick={(event) => {
              event.preventDefault();
              if (tenant) mutation.mutate(tenant.id);
            }}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Suppression…
              </>
            ) : (
              "Supprimer"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
