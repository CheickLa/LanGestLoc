import { z } from "zod";

export const TENANT_NAME_MAX_LENGTH = 60;

export const tenantSchema = z.object({
  name: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(
      TENANT_NAME_MAX_LENGTH,
      `Le nom ne doit pas dépasser ${TENANT_NAME_MAX_LENGTH} caractères.`,
    ),
  activity: z.string().optional(),
  phone: z.string().min(1, "Le téléphone est requis."),
  dateOfBirth: z
    .string()
    .min(1, "La date de naissance est requise.")
    .refine(
      (value) => new Date(value) < new Date(),
      "La date de naissance doit être dans le passé.",
    ),
  birthPlace: z
    .string()
    .min(2, "Le lieu de naissance doit contenir au moins 2 caractères."),
  idNumber: z
    .string()
    .min(5, "La pièce d'identité doit contenir au moins 5 caractères."),
});

export type TenantValues = z.infer<typeof tenantSchema>;
