import { PrismaClient, Role } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Seed désactivé en production.');
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME ?? 'Administrateur';

  if (!adminEmail || !adminPassword) {
    throw new Error(
      'ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans les variables d\'environnement.',
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existing) {
    console.log(`Admin "${adminEmail}" existe déjà, seed ignoré.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  console.log(`Admin "${adminEmail}" créé avec succès.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
