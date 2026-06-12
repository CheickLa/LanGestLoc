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

type LocalListItem = components["schemas"]["LocalListItemEntity"];

async function deleteLocal(localId: number): Promise<void> {
  const response = await fetch(`/api/locals/${localId}`, { method: "DELETE" });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(
      data?.message ??
        (response.status === 409
          ? "Impossible : des contrats sont associés à ce local."
          : "Suppression impossible. Réessayez."),
    );
  }
}

export function DeleteLocalDialog({
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
  const mutation = useMutation({
    mutationFn: (localId: number) => deleteLocal(localId),
    onSuccess: () => {
      toast.success("Local supprimé.");
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
          <AlertDialogTitle>Supprimer ce local ?</AlertDialogTitle>
          <AlertDialogDescription>
            {local
              ? `Le local « ${local.name} » (${local.code}) sera définitivement supprimé. Cette action est irréversible.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending || !local}
            onClick={(event) => {
              event.preventDefault();
              if (local) mutation.mutate(local.id);
            }}
            className="bg-danger text-danger-foreground hover:bg-danger/90"
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
