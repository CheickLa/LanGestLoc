import { config } from 'dotenv';
config({ path: '../.env' });

import {
  PrismaClient,
  Role,
  ContractStatus,
  PaymentMethod,
  PaymentType,
  RentDueStatus,
  DepositStatus,
  type Payment,
  type RentDue,
} from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Retourne le 1er du mois à 00:00:00 UTC */
function firstOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

/** Retourne le 5 du mois à 00:00:00 UTC (dueDate) */
function fifthOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 5));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Seed désactivé en production.');
    return;
  }

  // ── 1. Users ─────────────────────────────────────────────────────────────

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME ?? 'Administrateur';

  if (!adminEmail || !adminPassword) {
    throw new Error(
      'ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans les variables d\'environnement.',
    );
  }

  const hashedAdminPwd = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: adminName,
      email: adminEmail,
      password: hashedAdminPwd,
      role: Role.ADMIN,
    },
  });
  console.log(`✓ Admin "${admin.email}"`);

  const userEmail = process.env.USER_EMAIL;
  const userPassword = process.env.USER_PASSWORD;
  const userName = process.env.USER_NAME ?? 'Agent';

  let user = admin; // fallback si pas de user configuré
  if (userEmail && userPassword) {
    const hashedUserPwd = await bcrypt.hash(userPassword, 10);
    user = await prisma.user.upsert({
      where: { email: userEmail },
      update: {},
      create: {
        name: userName,
        email: userEmail,
        password: hashedUserPwd,
        role: Role.USER,
      },
    });
    console.log(`✓ User "${user.email}"`);
  } else {
    console.log('⏭ USER_EMAIL/USER_PASSWORD non définis, user seed ignoré');
  }

  // ── 2. Locals (4) ───────────────────────────────────────────────────────

  const localsData = [
    { code: 'LOCAL-001', name: 'Boutique 1' },
    { code: 'LOCAL-002', name: 'Boutique 2' },
    { code: 'LOCAL-003', name: 'Boutique 3' },
    { code: 'LOCAL-004', name: 'Boutique 4' },
  ];

  const locals = await Promise.all(
    localsData.map((data) =>
      prisma.local.upsert({
        where: { code: data.code },
        update: {},
        create: data,
      }),
    ),
  );
  console.log(`✓ ${locals.length} locaux`);

  // ── 3. Tenants (5) ──────────────────────────────────────────────────────

  const tenantsData = [
    {
      name: 'Ibrahima Soumah',
      activity: 'Vente de tissus',
      phone: '+224620000001',
      dateOfBirth: new Date('1985-03-15'),
      birthPlace: 'Conakry',
      idNumber: 'GN-ID-000001',
    },
    {
      name: 'Fatoumata Camara',
      activity: 'Cosmétiques',
      phone: '+224620000002',
      dateOfBirth: new Date('1990-07-22'),
      birthPlace: 'Kindia',
      idNumber: 'GN-ID-000002',
    },
    {
      name: 'Ousmane Barry',
      activity: 'Alimentation générale',
      phone: '+224620000003',
      dateOfBirth: new Date('1978-11-10'),
      birthPlace: 'Labé',
      idNumber: 'GN-ID-000003',
    },
    {
      name: 'Aissatou Bah',
      activity: 'Téléphonie mobile',
      phone: '+224620000004',
      dateOfBirth: new Date('1992-01-28'),
      birthPlace: 'Kankan',
      idNumber: 'GN-ID-000004',
    },
    {
      name: 'Mamadou Sylla',
      activity: 'Quincaillerie',
      phone: '+224620000005',
      dateOfBirth: new Date('1980-06-05'),
      birthPlace: 'Boké',
      idNumber: 'GN-ID-000005',
    },
  ];

  const tenants = await Promise.all(
    tenantsData.map((data) =>
      prisma.tenant.upsert({
        where: { phone: data.phone },
        update: {},
        create: data,
      }),
    ),
  );
  console.log(`✓ ${tenants.length} locataires`);

  // ── 4. Contracts (6) ────────────────────────────────────────────────────
  //
  //  LOCAL-001 : contrat 1 (Ousmane, TERMINATED juil–déc 2025)
  //            contrat 2 (Ibrahima, ACTIVE depuis jan 2026)
  //  LOCAL-002 : contrat 3 (Aissatou, CANCELED oct 2025 — annulé sans paiement)
  //            contrat 4 (Fatoumata, ACTIVE depuis fév 2026)
  //  LOCAL-003 : contrat 5 (Mamadou Sylla, ACTIVE depuis jan 2026)
  //  LOCAL-004 : contrat 6 (Ousmane, ACTIVE depuis mars 2026 — 2e contrat du même tenant)

  // Contrat 1 : Ousmane → LOCAL-001 (TERMINATED, juil–déc 2025)
  const contract1 = await prisma.contract.upsert({
    where: { id: 1 },
    update: {},
    create: {
      localId: locals[0].id,
      tenantId: tenants[2].id, // Ousmane
      startDate: firstOfMonth(2025, 7),
      endDate: new Date(Date.UTC(2025, 11, 31)), // 31 déc 2025
      status: ContractStatus.TERMINATED,
      createdById: admin.id,
    },
  });

  // Contrat 2 : Ibrahima → LOCAL-001 (ACTIVE, depuis jan 2026 — succède au contrat 1)
  const contract2 = await prisma.contract.upsert({
    where: { id: 2 },
    update: {},
    create: {
      localId: locals[0].id,
      tenantId: tenants[0].id, // Ibrahima
      startDate: firstOfMonth(2026, 1),
      status: ContractStatus.ACTIVE,
      createdById: admin.id,
    },
  });

  // Contrat 3 : Aissatou → LOCAL-002 (CANCELED, oct 2025 — annulé avant tout paiement)
  const contract3 = await prisma.contract.upsert({
    where: { id: 3 },
    update: {},
    create: {
      localId: locals[1].id,
      tenantId: tenants[3].id, // Aissatou
      startDate: firstOfMonth(2025, 10),
      endDate: firstOfMonth(2025, 10),
      status: ContractStatus.CANCELED,
      createdById: admin.id,
    },
  });

  // Contrat 4 : Fatoumata → LOCAL-002 (ACTIVE, depuis fév 2026 — succède au contrat 3)
  const contract4 = await prisma.contract.upsert({
    where: { id: 4 },
    update: {},
    create: {
      localId: locals[1].id,
      tenantId: tenants[1].id, // Fatoumata
      startDate: firstOfMonth(2026, 2),
      status: ContractStatus.ACTIVE,
      createdById: admin.id,
    },
  });

  // Contrat 5 : Mamadou Sylla → LOCAL-003 (ACTIVE, depuis jan 2026)
  const contract5 = await prisma.contract.upsert({
    where: { id: 5 },
    update: {},
    create: {
      localId: locals[2].id,
      tenantId: tenants[4].id, // Mamadou Sylla
      startDate: firstOfMonth(2026, 1),
      status: ContractStatus.ACTIVE,
      createdById: user.id,
    },
  });

  // Contrat 6 : Ousmane → LOCAL-004 (ACTIVE, depuis mars 2026 — 2e contrat, autre local)
  const contract6 = await prisma.contract.upsert({
    where: { id: 6 },
    update: {},
    create: {
      localId: locals[3].id,
      tenantId: tenants[2].id, // Ousmane (même tenant que contrat 1)
      startDate: firstOfMonth(2026, 3),
      status: ContractStatus.ACTIVE,
      createdById: admin.id,
    },
  });

  console.log(`✓ 6 contrats (4 ACTIVE, 1 TERMINATED, 1 CANCELED)`);

  // ── 5. Deposits (6) ─────────────────────────────────────────────────────

  await prisma.deposit.upsert({
    where: { contractId: contract1.id },
    update: {},
    create: {
      contractId: contract1.id,
      amount: 400_000,
      status: DepositStatus.REFUNDED,
      refundedAt: new Date(Date.UTC(2026, 0, 5)), // 5 jan 2026
    },
  });

  await prisma.deposit.upsert({
    where: { contractId: contract2.id },
    update: {},
    create: {
      contractId: contract2.id,
      amount: 500_000,
      status: DepositStatus.HELD,
    },
  });

  await prisma.deposit.upsert({
    where: { contractId: contract3.id },
    update: {},
    create: {
      contractId: contract3.id,
      amount: 600_000,
      status: DepositStatus.REFUNDED,
      refundedAt: new Date(Date.UTC(2025, 9, 15)), // 15 oct 2025
    },
  });

  await prisma.deposit.upsert({
    where: { contractId: contract4.id },
    update: {},
    create: {
      contractId: contract4.id,
      amount: 750_000,
      status: DepositStatus.HELD,
    },
  });

  await prisma.deposit.upsert({
    where: { contractId: contract5.id },
    update: {},
    create: {
      contractId: contract5.id,
      amount: 350_000,
      status: DepositStatus.HELD,
    },
  });

  await prisma.deposit.upsert({
    where: { contractId: contract6.id },
    update: {},
    create: {
      contractId: contract6.id,
      amount: 450_000,
      status: DepositStatus.HELD,
    },
  });

  console.log(`✓ 6 cautions (4 HELD, 2 REFUNDED)`);

  // ── 6. Rents ─────────────────────────────────────────────────────────────

  // Contrat 1 : 400 000 GNF juil–déc 2025
  const rent1 = await prisma.rent.upsert({
    where: { id: 1 },
    update: {},
    create: {
      contractId: contract1.id,
      amount: 400_000,
      effectiveFrom: firstOfMonth(2025, 7),
      effectiveTo: new Date(Date.UTC(2025, 11, 31)),
    },
  });

  // Contrat 2 : 500 000 GNF jan–fév 2026, puis augmentation à 550 000 en mars (SCD)
  const rent2a = await prisma.rent.upsert({
    where: { id: 2 },
    update: {},
    create: {
      contractId: contract2.id,
      amount: 500_000,
      effectiveFrom: firstOfMonth(2026, 1),
      effectiveTo: new Date(Date.UTC(2026, 1, 28)), // 28 fév 2026
    },
  });

  const rent2b = await prisma.rent.upsert({
    where: { id: 3 },
    update: {},
    create: {
      contractId: contract2.id,
      amount: 550_000,
      effectiveFrom: firstOfMonth(2026, 3),
    },
  });

  // Contrat 3 : pas de rent (CANCELED avant paiement)

  // Contrat 4 : 750 000 GNF depuis fév 2026
  const rent4 = await prisma.rent.upsert({
    where: { id: 4 },
    update: {},
    create: {
      contractId: contract4.id,
      amount: 750_000,
      effectiveFrom: firstOfMonth(2026, 2),
    },
  });

  // Contrat 5 : 350 000 GNF depuis jan 2026
  const rent5 = await prisma.rent.upsert({
    where: { id: 5 },
    update: {},
    create: {
      contractId: contract5.id,
      amount: 350_000,
      effectiveFrom: firstOfMonth(2026, 1),
    },
  });

  // Contrat 6 : 450 000 GNF depuis mars 2026
  const rent6 = await prisma.rent.upsert({
    where: { id: 6 },
    update: {},
    create: {
      contractId: contract6.id,
      amount: 450_000,
      effectiveFrom: firstOfMonth(2026, 3),
    },
  });

  console.log(`✓ 6 loyers (dont 1 augmentation SCD sur contrat 2)`);

  // ── 7. RentDues ──────────────────────────────────────────────────────────

  // Contrat 1 (TERMINATED) : juil–déc 2025, tous PAID
  const rentDues1: RentDue[] = [];
  for (const m of [7, 8, 9, 10, 11, 12]) {
    const rd = await prisma.rentDue.upsert({
      where: { contractId_month: { contractId: contract1.id, month: firstOfMonth(2025, m) } },
      update: {},
      create: {
        contractId: contract1.id,
        rentId: rent1.id,
        month: firstOfMonth(2025, m),
        amount: 400_000,
        dueDate: fifthOfMonth(2025, m),
        status: RentDueStatus.PAID,
      },
    });
    rentDues1.push(rd);
  }

  // Contrat 2 (ACTIVE) : jan–avr 2026 (jan-fév à 500k, mars-avr à 550k après augmentation)
  const rentDues2: RentDue[] = [];
  for (const m of [1, 2, 3, 4]) {
    const isNewRent = m >= 3;
    const rd = await prisma.rentDue.upsert({
      where: { contractId_month: { contractId: contract2.id, month: firstOfMonth(2026, m) } },
      update: {},
      create: {
        contractId: contract2.id,
        rentId: isNewRent ? rent2b.id : rent2a.id,
        month: firstOfMonth(2026, m),
        amount: isNewRent ? 550_000 : 500_000,
        dueDate: fifthOfMonth(2026, m),
        status: m <= 3 ? RentDueStatus.PAID : RentDueStatus.PENDING,
      },
    });
    rentDues2.push(rd);
  }

  // Contrat 4 (ACTIVE) : fév–avr 2026 (fév payé, mars LATE, avr PENDING)
  const rentDues4: RentDue[] = [];
  for (const m of [2, 3, 4]) {
    const rd = await prisma.rentDue.upsert({
      where: { contractId_month: { contractId: contract4.id, month: firstOfMonth(2026, m) } },
      update: {},
      create: {
        contractId: contract4.id,
        rentId: rent4.id,
        month: firstOfMonth(2026, m),
        amount: 750_000,
        dueDate: fifthOfMonth(2026, m),
        status: m === 2 ? RentDueStatus.PAID : m === 3 ? RentDueStatus.LATE : RentDueStatus.PENDING,
      },
    });
    rentDues4.push(rd);
  }

  // Contrat 5 (ACTIVE) : jan–avr 2026 (jan-fév payés, mars-avr PENDING)
  const rentDues5: RentDue[] = [];
  for (const m of [1, 2, 3, 4]) {
    const rd = await prisma.rentDue.upsert({
      where: { contractId_month: { contractId: contract5.id, month: firstOfMonth(2026, m) } },
      update: {},
      create: {
        contractId: contract5.id,
        rentId: rent5.id,
        month: firstOfMonth(2026, m),
        amount: 350_000,
        dueDate: fifthOfMonth(2026, m),
        status: m <= 2 ? RentDueStatus.PAID : RentDueStatus.PENDING,
      },
    });
    rentDues5.push(rd);
  }

  // Contrat 6 (ACTIVE) : mars–avr 2026 (mars payé, avr PENDING)
  const rentDues6: RentDue[] = [];
  for (const m of [3, 4]) {
    const rd = await prisma.rentDue.upsert({
      where: { contractId_month: { contractId: contract6.id, month: firstOfMonth(2026, m) } },
      update: {},
      create: {
        contractId: contract6.id,
        rentId: rent6.id,
        month: firstOfMonth(2026, m),
        amount: 450_000,
        dueDate: fifthOfMonth(2026, m),
        status: m === 3 ? RentDueStatus.PAID : RentDueStatus.PENDING,
      },
    });
    rentDues6.push(rd);
  }

  const totalRentDues = rentDues1.length + rentDues2.length + rentDues4.length + rentDues5.length + rentDues6.length;
  console.log(`✓ ${totalRentDues} échéances`);

  // ── 8. Payments + PaymentLines ───────────────────────────────────────────

  const allPayments: Payment[] = [];

  // 8.a DEPOSIT_HELD : 1 paiement par contrat ayant une caution (créé à la signature)

  const depositHeld1 = await prisma.payment.create({
    data: {
      contractId: contract1.id,
      type: PaymentType.DEPOSIT_HELD,
      amount: 400_000,
      paymentDate: firstOfMonth(2025, 7),
      paymentMethod: PaymentMethod.CASH,
      createdById: admin.id,
    },
  });
  allPayments.push(depositHeld1);

  const depositHeld2 = await prisma.payment.create({
    data: {
      contractId: contract2.id,
      type: PaymentType.DEPOSIT_HELD,
      amount: 500_000,
      paymentDate: firstOfMonth(2026, 1),
      paymentMethod: PaymentMethod.CASH,
      createdById: admin.id,
    },
  });
  allPayments.push(depositHeld2);

  const depositHeld3 = await prisma.payment.create({
    data: {
      contractId: contract3.id,
      type: PaymentType.DEPOSIT_HELD,
      amount: 600_000,
      paymentDate: firstOfMonth(2025, 10),
      paymentMethod: PaymentMethod.CASH,
      createdById: admin.id,
    },
  });
  allPayments.push(depositHeld3);

  const depositHeld4 = await prisma.payment.create({
    data: {
      contractId: contract4.id,
      type: PaymentType.DEPOSIT_HELD,
      amount: 750_000,
      paymentDate: firstOfMonth(2026, 2),
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      createdById: admin.id,
    },
  });
  allPayments.push(depositHeld4);

  const depositHeld5 = await prisma.payment.create({
    data: {
      contractId: contract5.id,
      type: PaymentType.DEPOSIT_HELD,
      amount: 350_000,
      paymentDate: firstOfMonth(2026, 1),
      paymentMethod: PaymentMethod.MOBILE_MONEY,
      createdById: user.id,
    },
  });
  allPayments.push(depositHeld5);

  const depositHeld6 = await prisma.payment.create({
    data: {
      contractId: contract6.id,
      type: PaymentType.DEPOSIT_HELD,
      amount: 450_000,
      paymentDate: firstOfMonth(2026, 3),
      paymentMethod: PaymentMethod.CASH,
      createdById: admin.id,
    },
  });
  allPayments.push(depositHeld6);

  // 8.b DEPOSIT_REFUND : contrats dont la caution est REFUNDED (1 et 3)

  // Contrat 1 : remboursement à la résiliation (5 jan 2026, cohérent avec deposit.refundedAt)
  const depositRefund1 = await prisma.payment.create({
    data: {
      contractId: contract1.id,
      type: PaymentType.DEPOSIT_REFUND,
      amount: 400_000,
      paymentDate: new Date(Date.UTC(2026, 0, 5)),
      paymentMethod: PaymentMethod.CASH,
      createdById: admin.id,
    },
  });
  allPayments.push(depositRefund1);

  // Contrat 3 : remboursement à l'annulation (15 oct 2025, cohérent avec deposit.refundedAt)
  const depositRefund3 = await prisma.payment.create({
    data: {
      contractId: contract3.id,
      type: PaymentType.DEPOSIT_REFUND,
      amount: 600_000,
      paymentDate: new Date(Date.UTC(2025, 9, 15)),
      paymentMethod: PaymentMethod.CASH,
      createdById: admin.id,
    },
  });
  allPayments.push(depositRefund3);

  // 8.c RENT : paiements de loyer

  // Contrat 1 : 1 paiement multi-mois (6 mois d'un coup)
  const pay1 = await prisma.payment.create({
    data: {
      contractId: contract1.id,
      type: PaymentType.RENT,
      amount: 2_400_000,
      paymentDate: fifthOfMonth(2025, 7),
      paymentMethod: PaymentMethod.CASH,
      createdById: admin.id,
      paymentLines: {
        create: rentDues1.map((rd) => ({ rentDueId: rd.id })),
      },
    },
  });
  allPayments.push(pay1);

  // Contrat 2 : 3 paiements mensuels (jan, fév, mars)
  for (let i = 0; i < 3; i++) {
    const pay = await prisma.payment.create({
      data: {
        contractId: contract2.id,
        type: PaymentType.RENT,
        amount: rentDues2[i].amount,
        paymentDate: fifthOfMonth(2026, i + 1),
        paymentMethod: i === 0 ? PaymentMethod.CASH : PaymentMethod.ORANGE_MONEY,
        createdById: user.id,
        paymentLines: {
          create: { rentDueId: rentDues2[i].id },
        },
      },
    });
    allPayments.push(pay);
  }

  // Contrat 4 : 1 paiement (fév)
  const pay4 = await prisma.payment.create({
    data: {
      contractId: contract4.id,
      type: PaymentType.RENT,
      amount: 750_000,
      paymentDate: fifthOfMonth(2026, 2),
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      createdById: user.id,
      paymentLines: {
        create: { rentDueId: rentDues4[0].id },
      },
    },
  });
  allPayments.push(pay4);

  // Contrat 5 : 1 paiement multi-mois (jan + fév)
  const pay5 = await prisma.payment.create({
    data: {
      contractId: contract5.id,
      type: PaymentType.RENT,
      amount: 700_000,
      paymentDate: fifthOfMonth(2026, 2),
      paymentMethod: PaymentMethod.MOBILE_MONEY,
      createdById: user.id,
      paymentLines: {
        create: [
          { rentDueId: rentDues5[0].id },
          { rentDueId: rentDues5[1].id },
        ],
      },
    },
  });
  allPayments.push(pay5);

  // Contrat 6 : 1 paiement (mars)
  const pay6 = await prisma.payment.create({
    data: {
      contractId: contract6.id,
      type: PaymentType.RENT,
      amount: 450_000,
      paymentDate: fifthOfMonth(2026, 3),
      paymentMethod: PaymentMethod.CASH,
      createdById: admin.id,
      paymentLines: {
        create: { rentDueId: rentDues6[0].id },
      },
    },
  });
  allPayments.push(pay6);

  console.log(`✓ ${allPayments.length} paiements (6 RENT, 6 DEPOSIT_HELD, 2 DEPOSIT_REFUND)`);

  // ── 9. Receipts ──────────────────────────────────────────────────────────

  for (let i = 0; i < allPayments.length; i++) {
    const year = allPayments[i].paymentDate.getUTCFullYear();
    const receiptNo = `REC-${year}-${String(i + 1).padStart(5, '0')}`;
    await prisma.receipt.upsert({
      where: { paymentId: allPayments[i].id },
      update: {},
      create: {
        paymentId: allPayments[i].id,
        receiptNo,
        s3Key: `receipts/${year}/${receiptNo}.pdf`,
      },
    });
  }

  console.log(`✓ ${allPayments.length} reçus`);

  // ── Résumé ───────────────────────────────────────────────────────────────

  console.log('\n── Seed terminé ──');
  console.log('  Contrat 1 (Boutique 1, Ousmane)    : juil–déc 2025, TERMINATED, caution HELD→REFUNDED, loyers payés en 1 fois');
  console.log('  Contrat 2 (Boutique 1, Ibrahima)   : jan–avr 2026, ACTIVE, caution HELD, augmentation mars, 3 loyers payés, avr PENDING');
  console.log('  Contrat 3 (Boutique 2, Aissatou)   : oct 2025, CANCELED, caution HELD→REFUNDED, aucun loyer');
  console.log('  Contrat 4 (Boutique 2, Fatoumata)  : fév–avr 2026, ACTIVE, caution HELD, fév payé, mars LATE, avr PENDING');
  console.log('  Contrat 5 (Boutique 3, Mamadou S.) : jan–avr 2026, ACTIVE, caution HELD, jan+fév payés multi-mois, mars-avr PENDING');
  console.log('  Contrat 6 (Boutique 4, Ousmane)    : mars–avr 2026, ACTIVE, caution HELD, mars payé, avr PENDING');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
