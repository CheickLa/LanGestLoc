import { z } from "zod";

export const LOCAL_NAME_MAX_LENGTH = 40;

export const localSchema = z.object({
  code: z
    .string()
    .regex(/^LOCAL-\d{3}$/, "Format attendu : LOCAL-XXX (3 chiffres)."),
  name: z
    .string()
    .min(1, "Le nom est requis.")
    .max(
      LOCAL_NAME_MAX_LENGTH,
      `Le nom ne doit pas dépasser ${LOCAL_NAME_MAX_LENGTH} caractères.`,
    ),
});

export type LocalValues = z.infer<typeof localSchema>;
