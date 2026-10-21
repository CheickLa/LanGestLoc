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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { roleLabel } from "@/lib/user";

type User = components["schemas"]["UserEntity"];

const PASSWORD_MIN = "Le mot de passe doit contenir au moins 8 caractères.";

const baseFields = {
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères."),
  email: z.email("Adresse e-mail invalide."),
  role: z.enum(["USER", "ADMIN"]),
};

const createSchema = z.object({
  ...baseFields,
  password: z.string().min(8, PASSWORD_MIN),
});

// En modification, un mot de passe vide laisse l'actuel en place
const editSchema = z.object({
  ...baseFields,
  password: z.string().refine((v) => v === "" || v.length >= 8, PASSWORD_MIN),
});

type UserValues = z.infer<typeof createSchema>;

async function submitUser(userId: number | null, values: UserValues) {
  const { password, ...rest } = values;
  const payload = password ? values : rest;

  const response = await fetch(userId ? `/api/users/${userId}` : "/api/users", {
    method: userId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(
      data?.message ??
        (response.status === 409
          ? "Un utilisateur avec cet email existe déjà."
          : "Enregistrement impossible. Réessayez."),
    );
  }
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50";

export function UserFormDialog({
  open,
  user,
  isSelf,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  user: User | null;
  isSelf: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const isEdit = user !== null;

  const form = useForm<UserValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: { name: "", email: "", password: "", role: "USER" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: user?.name ?? "",
        email: user?.email ?? "",
        password: "",
        role: user?.role ?? "USER",
      });
    }
  }, [open, user, form]);

  const mutation = useMutation({
    mutationFn: (values: UserValues) => submitUser(user?.id ?? null, values),
    onSuccess: () => {
      toast.success(isEdit ? "Utilisateur mis à jour." : "Utilisateur créé.");
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
            {isEdit ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifie les informations du compte."
              : "Crée un compte et transmets le mot de passe à son titulaire."}
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
                      placeholder="Mamadou Diallo"
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="mamadou@example.com"
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isEdit ? "Nouveau mot de passe" : "Mot de passe"}
                    {isEdit ? (
                      <span className="text-muted-foreground"> (optionnel)</span>
                    ) : null}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      disabled={mutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  {isEdit ? (
                    <FormDescription>
                      Laisse vide pour garder le mot de passe actuel.
                    </FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rôle</FormLabel>
                  <FormControl>
                    <select
                      className={selectClass}
                      disabled={mutation.isPending || isSelf}
                      {...field}
                    >
                      <option value="USER">{roleLabel("USER")}</option>
                      <option value="ADMIN">{roleLabel("ADMIN")}</option>
                    </select>
                  </FormControl>
                  {isSelf ? (
                    <FormDescription>
                      Tu ne peux pas changer ton propre rôle.
                    </FormDescription>
                  ) : null}
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
