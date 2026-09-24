import { NestFactory } from '@nestjs/core';
import { PrismaService } from '@/prisma/prisma.service';
import { CliModule } from './cli.module';
import { createFirstAdmin } from './create-first-admin';
import { askHidden, askVisible, assertInteractive } from './prompt';

/**
 * Crée le premier compte ADMIN en production : le seed y est désactivé et
 * `POST /auth/register` exige déjà un ADMIN.
 *
 *   docker compose -f compose.prod.yml run --rm api node dist/src/cli/create-admin.js
 */
async function main(): Promise<number> {
  assertInteractive(process.stdin);

  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error', 'warn'],
  });
  try {
    console.log('Création du premier compte ADMIN\n');
    const email = await askVisible('E-mail : ');
    const name = await askVisible('Nom : ');
    const password = await askHidden('Mot de passe (8 caractères minimum) : ');
    const passwordConfirmation = await askHidden(
      'Confirmation du mot de passe : ',
    );

    const admin = await createFirstAdmin(app.get(PrismaService), {
      email,
      name,
      password,
      passwordConfirmation,
    });
    console.log(`\nADMIN créé : ${admin.email} (id ${admin.id})`);
    return 0;
  } finally {
    await app.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(
      `\n${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  },
);
