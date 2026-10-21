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

type User = components["schemas"]["UserEntity"];

async function deleteUser(userId: number): Promise<void> {
  const response = await fetch(`/api/users/${userId}`, { method: "DELETE" });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(data?.message ?? "Suppression impossible. Réessayez.");
  }
}

export function DeleteUserDialog({
  open,
  user,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  user: User | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const mutation = useMutation({
    mutationFn: (userId: number) => deleteUser(userId),
    onSuccess: () => {
      toast.success("Utilisateur supprimé.");
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
          <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
          <AlertDialogDescription>
            {user
              ? `Le compte de « ${user.name} » sera définitivement supprimé. Un compte qui a enregistré des contrats ou des paiements ne peut pas l'être.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            variant="danger"
            disabled={mutation.isPending || !user}
            onClick={(event) => {
              event.preventDefault();
              if (user) mutation.mutate(user.id);
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
