import type { UserEntity } from "@/lib/auth-server";

/** Initiales d'affichage (max 2 lettres) : "Cheick T." → "CT". */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

const ROLE_LABELS: Record<UserEntity["role"], string> = {
  ADMIN: "Administrateur",
  USER: "Utilisateur",
};

/** Libellé lisible du rôle pour l'affichage. */
export function roleLabel(role: UserEntity["role"]): string {
  return ROLE_LABELS[role];
}
