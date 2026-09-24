import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma, Role } from '@generated/prisma/client';
import { RegisterDto } from '@/auth/dto';
import { hashPassword } from '@/common/password';
import { PrismaService } from '@/prisma/prisma.service';

export interface FirstAdminInput {
  email: string;
  name: string;
  password: string;
  passwordConfirmation: string;
}

export interface CreatedAdmin {
  id: number;
  email: string;
  name: string;
}

/** Refus attendu (saisie invalide, ADMIN déjà présent) : message pour l'opérateur */
export class FirstAdminError extends Error {}

/**
 * Crée le premier compte ADMIN d'une base de production, avec les mêmes
 * règles que `POST /auth/register` (RegisterDto). Refuse s'il existe déjà
 * un ADMIN : une seconde exécution ne peut ni écraser ni dupliquer.
 */
export async function createFirstAdmin(
  prisma: PrismaService,
  input: FirstAdminInput,
): Promise<CreatedAdmin> {
  if (input.password !== input.passwordConfirmation) {
    throw new FirstAdminError('Les deux mots de passe ne correspondent pas.');
  }

  const dto = plainToInstance(RegisterDto, {
    email: input.email,
    name: input.name,
    password: input.password,
  });
  const errors = await validate(dto);
  if (errors.length > 0) {
    const details = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    throw new FirstAdminError(`Saisie invalide : ${details.join(' ; ')}`);
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    select: { id: true },
  });
  if (existingAdmin) {
    throw new FirstAdminError(
      "Un ADMIN existe déjà : cette commande ne sert qu'à créer le premier.",
    );
  }

  try {
    return await prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: await hashPassword(dto.password),
        role: Role.ADMIN,
      },
      select: { id: true, email: true, name: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new FirstAdminError(
        `Un compte utilise déjà l'e-mail ${dto.email}.`,
      );
    }
    throw error;
  }
}
