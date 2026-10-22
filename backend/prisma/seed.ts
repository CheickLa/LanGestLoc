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
} from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import * as bcrypt from 'bcrypt';
import { buildReceiptPdf } from '@/receipts/pdf/pdf-builder';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ── Jeu de données ───────────────────────────────────────────────────────────
//
// Un centre commercial de Conakry : 26 locaux, une quarantaine de locataires,
// environ deux ans et demi d'historique jusqu'à aujourd'hui. Les dates sont
// calculées depuis la date du jour : le tableau de bord a toujours six mois
// d'encaissements, des retards et des loyers du mois en cours.
// Tirage pseudo-aléatoire à graine fixe : deux seeds le même jour donnent la même base.

const NOW = new Date();
const CURRENT = NOW.getUTCFullYear() * 12 + NOW.getUTCMonth();
const HISTORY = 30;

let state = 20261022;
function random(): number {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const chance = (p: number) => random() < p;
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}
function weighted<T>(entries: readonly [T, number][]): T {
  let r = random() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [value, w] of entries) {
    r -= w;
    if (r < 0) return value;
  }
  return entries[entries.length - 1][0];
}

// Un mois est un index (année × 12 + mois 0-based), en UTC.
const monthStart = (m: number) =>
  new Date(Date.UTC(Math.floor(m / 12), m % 12, 1));
const lastDayOf = (m: number) =>
  new Date(Date.UTC(Math.floor(m / 12), (m % 12) + 1, 0));
const dueDateOf = (m: number) =>
  new Date(Date.UTC(Math.floor(m / 12), (m % 12) + 1, 5));
function dayOf(m: number, day: number): Date {
  const last = lastDayOf(m).getUTCDate();
  return new Date(
    Date.UTC(Math.floor(m / 12), m % 12, Math.min(day, last), 10, int(0, 59)),
  );
}
const roundTo = (amount: number, step: number) =>
  Math.round(amount / step) * step;

const LOCALS = [
  ...['A', 'B', 'C'].flatMap((bloc) =>
    Array.from({ length: 8 }, (_, i) => ({
      code: `BTQ-${bloc}${String(i + 1).padStart(2, '0')}`,
      name: `Boutique ${bloc}${i + 1}`,
      rent: roundTo(int(900_000, 2_200_000), 50_000),
    })),
  ),
  { code: 'MAG-01', name: 'Magasin 1', rent: 3_500_000 },
  { code: 'MAG-02', name: 'Magasin 2', rent: 3_000_000 },
];

const TENANTS: {
  name: string;
  activity: string;
  birthPlace: string;
  born: string;
}[] = [
  {
    name: 'Mamadou Saliou Diallo',
    activity: 'Vente de tissus et wax',
    birthPlace: 'Labé',
    born: '1979-04-12',
  },
  {
    name: 'Fatoumata Binta Bah',
    activity: 'Cosmétiques et parfums',
    birthPlace: 'Pita',
    born: '1991-08-03',
  },
  {
    name: 'Ibrahima Sory Camara',
    activity: 'Téléphonie et accessoires',
    birthPlace: 'Conakry',
    born: '1988-01-25',
  },
  {
    name: 'Aïssatou Barry',
    activity: 'Couture et retouches',
    birthPlace: 'Mamou',
    born: '1985-11-17',
  },
  {
    name: 'Alpha Oumar Sow',
    activity: 'Alimentation générale',
    birthPlace: 'Dalaba',
    born: '1976-06-30',
  },
  {
    name: 'Kadiatou Condé',
    activity: 'Pagnes et bazins',
    birthPlace: 'Kankan',
    born: '1983-02-14',
  },
  {
    name: 'Sékou Kourouma',
    activity: 'Quincaillerie',
    birthPlace: 'Siguiri',
    born: '1974-09-08',
  },
  {
    name: 'Mariama Sylla',
    activity: 'Salon de coiffure',
    birthPlace: 'Boké',
    born: '1993-05-21',
  },
  {
    name: 'Lansana Keïta',
    activity: 'Électroménager',
    birthPlace: 'Kouroussa',
    born: '1980-12-02',
  },
  {
    name: 'Hawa Touré',
    activity: 'Chaussures et sacs',
    birthPlace: 'Conakry',
    born: '1990-03-19',
  },
  {
    name: 'Thierno Amadou Baldé',
    activity: 'Librairie et papeterie',
    birthPlace: 'Labé',
    born: '1982-07-11',
  },
  {
    name: 'Oumou Kalsoum Soumah',
    activity: 'Restauration rapide',
    birthPlace: 'Dubréka',
    born: '1987-10-05',
  },
  {
    name: 'Mohamed Lamine Cissé',
    activity: 'Transfert d’argent',
    birthPlace: 'Kindia',
    born: '1984-01-29',
  },
  {
    name: 'Djénabou Diallo',
    activity: 'Bijouterie',
    birthPlace: 'Télimélé',
    born: '1989-06-16',
  },
  {
    name: 'Moussa Traoré',
    activity: 'Pièces détachées auto',
    birthPlace: 'Kankan',
    born: '1977-03-07',
  },
  {
    name: 'Fanta Kaba',
    activity: 'Friperie',
    birthPlace: 'Faranah',
    born: '1992-09-24',
  },
  {
    name: 'Abdoulaye Bangoura',
    activity: 'Matériel informatique',
    birthPlace: 'Conakry',
    born: '1986-05-13',
  },
  {
    name: 'Nènè Aïssata Sow',
    activity: 'Produits cosmétiques naturels',
    birthPlace: 'Mamou',
    born: '1994-12-08',
  },
  {
    name: 'Kerfalla Camara',
    activity: 'Boissons et glaces',
    birthPlace: 'Coyah',
    born: '1981-08-27',
  },
  {
    name: 'Mabinty Sylla',
    activity: 'Vente de pagnes',
    birthPlace: 'Forécariah',
    born: '1988-04-04',
  },
  {
    name: 'Ousmane Konaté',
    activity: 'Vêtements pour hommes',
    birthPlace: 'Kissidougou',
    born: '1983-11-30',
  },
  {
    name: 'Hadja Mariama Barry',
    activity: 'Épicerie fine',
    birthPlace: 'Pita',
    born: '1972-02-20',
  },
  {
    name: 'Fodé Momo Soumah',
    activity: 'Atelier de réparation de téléphones',
    birthPlace: 'Conakry',
    born: '1995-07-09',
  },
  {
    name: 'Aminata Fofana',
    activity: 'Articles pour enfants',
    birthPlace: 'Kankan',
    born: '1990-10-15',
  },
  {
    name: 'Elhadj Boubacar Diallo',
    activity: 'Grossiste en riz et huile',
    birthPlace: 'Gaoual',
    born: '1969-05-01',
  },
  {
    name: 'Saran Kanté',
    activity: 'Tissus brodés',
    birthPlace: 'Siguiri',
    born: '1986-03-23',
  },
  {
    name: 'Mory Doumbouya',
    activity: 'Quincaillerie et peinture',
    birthPlace: 'Kérouané',
    born: '1979-12-12',
  },
  {
    name: 'Kadidiatou Baldé',
    activity: 'Mode féminine',
    birthPlace: 'Labé',
    born: '1997-01-06',
  },
  {
    name: 'Yacouba Haba',
    activity: 'Pharmacie vétérinaire',
    birthPlace: 'N’Zérékoré',
    born: '1978-08-18',
  },
  {
    name: 'Djéné Kourouma',
    activity: 'Vaisselle et ustensiles',
    birthPlace: 'Kankan',
    born: '1985-06-27',
  },
  {
    name: 'Alseny Bangoura',
    activity: 'Cybercafé et impression',
    birthPlace: 'Boffa',
    born: '1992-02-09',
  },
  {
    name: 'Rouguiatou Bah',
    activity: 'Lingerie et accessoires',
    birthPlace: 'Dalaba',
    born: '1989-09-01',
  },
  {
    name: 'Sidiki Cissé',
    activity: 'Matériaux électriques',
    birthPlace: 'Kindia',
    born: '1980-04-16',
  },
  {
    name: 'Mahawa Camara',
    activity: 'Produits laitiers',
    birthPlace: 'Fria',
    born: '1991-11-22',
  },
  {
    name: 'Pépé Loua',
    activity: 'Café et snacks',
    birthPlace: 'Macenta',
    born: '1984-07-03',
  },
  {
    name: 'Fatou Traoré',
    activity: 'Tresses et perruques',
    birthPlace: 'Conakry',
    born: '1996-05-28',
  },
  {
    name: 'Amadou Tidiane Sow',
    activity: 'Montres et lunettes',
    birthPlace: 'Tougué',
    born: '1987-12-19',
  },
  {
    name: 'Tiguidanké Diakité',
    activity: 'Tissus et rideaux',
    birthPlace: 'Mandiana',
    born: '1982-03-11',
  },
  {
    name: 'Ibrahima Kalil Konaté',
    activity: 'Panneaux solaires',
    birthPlace: 'Kankan',
    born: '1985-09-14',
  },
  {
    name: 'Marie Millimono',
    activity: 'Boulangerie et pâtisserie',
    birthPlace: 'Guéckédou',
    born: '1990-01-31',
  },
];

const METHODS: [PaymentMethod, number][] = [
  [PaymentMethod.ORANGE_MONEY, 45],
  [PaymentMethod.CASH, 35],
  [PaymentMethod.MOBILE_MONEY, 20],
];

type Profile = 'monthly' | 'quarterly' | 'advance' | 'slow' | 'defaulter';

type Plan = {
  local: number;
  tenant: number;
  start: number;
  /** Fin prévue (ACTIVE) ou fin effective (TERMINATED). */
  end: number | null;
  status: ContractStatus;
  rent: number;
  /** Mois de l'augmentation et nouveau montant. */
  increase?: { from: number; amount: number };
  profile: Profile;
};

// ── Plan d'occupation ────────────────────────────────────────────────────────

function buildPlans(): Plan[] {
  const plans: Plan[] = [];
  const freeTenants = TENANTS.map((_, i) => i);
  const takeTenant = () =>
    freeTenants.splice(int(0, freeTenants.length - 1), 1)[0];
  const order = LOCALS.map((_, i) => i).sort(() => random() - 0.5);

  order.forEach((local, rank) => {
    const base = LOCALS[local].rent;
    // 3 locaux jamais loués, 3 libérés récemment, 8 avec un ancien locataire, le reste occupé.
    const scenario =
      rank < 3
        ? 'empty'
        : rank < 6
          ? 'released'
          : rank < 14
            ? 'succession'
            : 'occupied';
    if (scenario === 'empty') return;

    let nextStart = CURRENT - int(1, HISTORY - 2);
    if (scenario === 'released' || scenario === 'succession') {
      const start = CURRENT - int(HISTORY - 6, HISTORY);
      const end =
        scenario === 'released'
          ? CURRENT - int(2, 4)
          : Math.min(start + int(8, 16), CURRENT - 4);
      plans.push({
        local,
        tenant: takeTenant(),
        start,
        end,
        status: ContractStatus.TERMINATED,
        rent: roundTo(base * 0.9, 50_000),
        profile: chance(0.7) ? 'monthly' : 'quarterly',
      });
      if (scenario === 'released') return;
      nextStart = Math.min(end + 1 + int(0, 2), CURRENT);
    }

    const profile = weighted<Profile>([
      ['monthly', 50],
      ['quarterly', 12],
      ['advance', 10],
      ['slow', 12],
      ['defaulter', 16],
    ]);
    const plan: Plan = {
      local,
      tenant: takeTenant(),
      start: nextStart,
      end: chance(0.3) ? nextStart + pick([23, 35]) : null,
      status: ContractStatus.ACTIVE,
      rent: base,
      profile,
    };
    if (plan.end !== null && plan.end <= CURRENT)
      plan.end = CURRENT + int(3, 12);
    // Pas d'augmentation pour qui paie plusieurs mois d'avance : ses mois sont déjà facturés.
    if (
      (profile === 'monthly' ||
        profile === 'slow' ||
        profile === 'defaulter') &&
      CURRENT - plan.start >= 14 &&
      chance(0.45)
    ) {
      plan.increase = {
        from: plan.start + 12,
        amount: roundTo(base * 1.1, 50_000),
      };
    }
    plans.push(plan);
  });

  // Deux contrats annulés avant le premier loyer, sur des locaux restés libres à l'époque.
  for (const months of [int(4, 9), int(12, 18)]) {
    const start = CURRENT - months;
    // Un mois n'est facturé qu'à un contrat : pas de contrat résilié du local après ce début.
    const local = plans.find(
      (p) =>
        p.status === ContractStatus.ACTIVE &&
        p.start > start + 1 &&
        !plans.some(
          (q) =>
            q.local === p.local &&
            q.status !== ContractStatus.ACTIVE &&
            (q.end ?? Infinity) >= start,
        ),
    )?.local;
    if (local === undefined) continue;
    plans.push({
      local,
      tenant: takeTenant(),
      start,
      end: null,
      status: ContractStatus.CANCELED,
      rent: LOCALS[local].rent,
      profile: 'monthly',
    });
  }
  return plans;
}

/** Mois soldés par chaque paiement, dans l'ordre, du plus ancien au plus récent. */
function schedulePayments(plan: Plan): { date: Date; months: number[] }[] {
  if (plan.status === ContractStatus.CANCELED) return [];
  const last =
    plan.status === ContractStatus.TERMINATED ? (plan.end as number) : CURRENT;
  // Un paiement à l'avance ne dépasse ni 12 mois après le mois en cours, ni la fin prévue.
  const ceiling = Math.min(CURRENT + 12, plan.end ?? Infinity);
  const stop = plan.profile === 'defaulter' ? CURRENT - int(0, 4) : Infinity;
  const payments: { date: Date; months: number[] }[] = [];

  let m = plan.start;
  while (m <= last && m < stop) {
    let size = 1;
    let date = dayOf(m, int(1, 8));
    if (plan.profile === 'quarterly') {
      size = 3;
      date = dayOf(m, int(1, 10));
    } else if (plan.profile === 'advance') {
      size = 6;
      date = dayOf(m, int(1, 6));
    } else if (plan.profile === 'slow') {
      date = dayOf(m + 1, int(8, 25));
    }
    const months: number[] = [];
    for (let k = m; k < m + size && k <= ceiling; k++) {
      if (plan.status === ContractStatus.TERMINATED && k > last) break;
      months.push(k);
    }
    if (date > NOW || months.length === 0) break;
    payments.push({ date, months });
    m += months.length;
  }
  return payments;
}

const rentAt = (plan: Plan, m: number) =>
  plan.increase && m >= plan.increase.from ? plan.increase.amount : plan.rent;

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Seed désactivé en production.');
    return;
  }

  // ── 1. Utilisateurs ───────────────────────────────────────────────────────

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans les variables d'environnement.",
    );
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: process.env.ADMIN_NAME ?? 'Administrateur',
      email: adminEmail,
      password: await bcrypt.hash(adminPassword, 10),
      role: Role.ADMIN,
    },
  });

  const agents: { id: number }[] = [];
  const userPassword = process.env.USER_PASSWORD;
  if (process.env.USER_EMAIL && userPassword) {
    const hashed = await bcrypt.hash(userPassword, 10);
    const accounts = [
      { email: process.env.USER_EMAIL, name: process.env.USER_NAME ?? 'Agent' },
      { email: 'kadiatou.barry@langestloc.com', name: 'Kadiatou Barry' },
      { email: 'moussa.conde@langestloc.com', name: 'Moussa Condé' },
    ];
    for (const account of accounts) {
      agents.push(
        await prisma.user.upsert({
          where: { email: account.email },
          update: {},
          create: { ...account, password: hashed, role: Role.USER },
        }),
      );
    }
  }
  const clerks: [number, number][] = [
    [admin.id, 25],
    ...agents.map((a): [number, number] => [a.id, 75 / agents.length]),
  ];
  console.log(`✓ ${1 + agents.length} utilisateurs`);

  if ((await prisma.local.count()) > 0) {
    console.log(
      '⏭ Données déjà présentes : lancer `prisma migrate reset` avant le seed.',
    );
    return;
  }

  // ── 2. Locaux et locataires ──────────────────────────────────────────────

  const locals: { id: number }[] = [];
  for (const { code, name } of LOCALS) {
    locals.push(await prisma.local.create({ data: { code, name } }));
  }

  const phones = new Set<string>();
  const tenants: { id: number }[] = [];
  for (const [i, t] of TENANTS.entries()) {
    let phone: string;
    do {
      phone = `+224${pick(['620', '621', '622', '624', '625', '628', '655', '657', '660', '664'])}${String(int(0, 999_999)).padStart(6, '0')}`;
    } while (phones.has(phone));
    phones.add(phone);
    tenants.push(
      await prisma.tenant.create({
        data: {
          name: t.name,
          activity: t.activity,
          phone,
          dateOfBirth: new Date(`${t.born}T00:00:00Z`),
          birthPlace: t.birthPlace,
          idNumber: `GN${String(1_000_000 + i * 7919 + int(0, 7000)).padStart(9, '0')}`,
        },
      }),
    );
  }
  console.log(`✓ ${locals.length} locaux, ${tenants.length} locataires`);

  // ── 3. Contrats, loyers, échéances, paiements ────────────────────────────

  const plans = buildPlans().sort((a, b) => a.start - b.start);
  const paymentIds: number[] = [];
  let dueCount = 0;

  for (const plan of plans) {
    // Caution versée le 1er à 8 h, avant tout loyer (versé à partir de 10 h).
    const depositDate = new Date(
      monthStart(plan.start).getTime() + 8 * 3_600_000,
    );
    const terminated = plan.status === ContractStatus.TERMINATED;
    const canceled = plan.status === ContractStatus.CANCELED;

    const contract = await prisma.contract.create({
      data: {
        localId: locals[plan.local].id,
        tenantId: tenants[plan.tenant].id,
        startDate: monthStart(plan.start),
        endDate: plan.end === null ? null : lastDayOf(plan.end),
        status: plan.status,
        createdById: admin.id,
        createdAt: depositDate,
      },
    });

    const firstRent = await prisma.rent.create({
      data: {
        contractId: contract.id,
        amount: plan.rent,
        effectiveFrom: monthStart(plan.start),
        effectiveTo: plan.increase
          ? new Date(monthStart(plan.increase.from).getTime() - 86_400_000)
          : null,
        createdAt: depositDate,
      },
    });
    const newRent = plan.increase
      ? await prisma.rent.create({
          data: {
            contractId: contract.id,
            amount: plan.increase.amount,
            effectiveFrom: monthStart(plan.increase.from),
            createdAt: dayOf(plan.increase.from - 1, int(10, 25)),
          },
        })
      : null;
    const rentIdAt = (m: number) =>
      newRent && m >= plan.increase!.from ? newRent.id : firstRent.id;

    const depositPayment = await prisma.payment.create({
      data: {
        contractId: contract.id,
        type: PaymentType.DEPOSIT_HELD,
        amount: plan.rent,
        paymentDate: depositDate,
        paymentMethod: weighted(METHODS),
        createdById: admin.id,
        createdAt: depositDate,
      },
    });
    paymentIds.push(depositPayment.id);

    const refundDate = canceled
      ? dayOf(plan.start, int(4, 15))
      : terminated
        ? dayOf((plan.end as number) + 1, int(2, 10))
        : null;
    await prisma.deposit.create({
      data: {
        contractId: contract.id,
        amount: plan.rent,
        status: refundDate ? DepositStatus.REFUNDED : DepositStatus.HELD,
        refundedAt: refundDate,
        createdAt: depositDate,
      },
    });

    // Échéances : chaque mois commencé de la période, plus les mois payés d'avance.
    const scheduled = schedulePayments(plan);
    const paid = new Set(scheduled.flatMap((p) => p.months));
    const lastDue = canceled
      ? plan.start - 1
      : terminated
        ? (plan.end as number)
        : Math.min(CURRENT, plan.end ?? CURRENT);
    const dueMonths = new Set<number>(paid);
    for (let m = plan.start; m <= lastDue; m++) dueMonths.add(m);

    const dueIds = new Map<number, number>();
    for (const m of [...dueMonths].sort((a, b) => a - b)) {
      const status = paid.has(m)
        ? RentDueStatus.PAID
        : dueDateOf(m) < NOW
          ? RentDueStatus.LATE
          : RentDueStatus.PENDING;
      const due = await prisma.rentDue.create({
        data: {
          contractId: contract.id,
          rentId: rentIdAt(m),
          month: monthStart(m),
          amount: rentAt(plan, m),
          dueDate: dueDateOf(m),
          status,
          createdAt: m > CURRENT ? NOW : monthStart(m),
        },
      });
      dueIds.set(m, due.id);
    }
    dueCount += dueIds.size;

    for (const { date, months } of scheduled) {
      const payment = await prisma.payment.create({
        data: {
          contractId: contract.id,
          type: PaymentType.RENT,
          amount: months.reduce((sum, m) => sum + rentAt(plan, m), 0),
          paymentDate: date,
          paymentMethod: weighted(METHODS),
          createdById: weighted(clerks),
          createdAt: date,
          paymentLines: {
            create: months.map((m) => ({ rentDueId: dueIds.get(m)! })),
          },
        },
      });
      paymentIds.push(payment.id);
    }

    if (refundDate) {
      const refund = await prisma.payment.create({
        data: {
          contractId: contract.id,
          type: PaymentType.DEPOSIT_REFUND,
          amount: plan.rent,
          paymentDate: refundDate,
          paymentMethod: PaymentMethod.CASH,
          createdById: admin.id,
          createdAt: refundDate,
        },
      });
      paymentIds.push(refund.id);
    }
  }

  const count = (status: ContractStatus) =>
    plans.filter((p) => p.status === status).length;
  const late = await prisma.rentDue.count({
    where: { status: RentDueStatus.LATE },
  });
  console.log(
    `✓ ${plans.length} contrats (${count(ContractStatus.ACTIVE)} actifs, ${count(ContractStatus.TERMINATED)} résiliés, ${count(ContractStatus.CANCELED)} annulés)`,
  );
  console.log(
    `✓ ${dueCount} échéances (${late} en retard), ${paymentIds.length} paiements`,
  );

  await createReceipts();
}

// ── 4. Reçus PDF ─────────────────────────────────────────────────────────────

async function createReceipts() {
  const env = (key: string) => process.env[key];
  const missing = [
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_BUCKET',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'BAILLEUR_NAME',
    'BAILLEUR_LIEU',
  ].filter((key) => !env(key));
  if (missing.length > 0) {
    console.log(`⏭ Reçus ignorés : ${missing.join(', ')} non défini(s)`);
    return;
  }

  const s3 = new S3Client({
    endpoint: env('S3_ENDPOINT'),
    region: env('S3_REGION'),
    credentials: {
      accessKeyId: env('S3_ACCESS_KEY')!,
      secretAccessKey: env('S3_SECRET_KEY')!,
    },
    forcePathStyle: true,
  });
  // En CI, le seed passe avant le démarrage de l'API qui crée le bucket.
  const Bucket = env('S3_BUCKET');
  await s3
    .send(new HeadBucketCommand({ Bucket }))
    .catch(() => s3.send(new CreateBucketCommand({ Bucket })));

  const payments = await prisma.payment.findMany({
    orderBy: [{ paymentDate: 'asc' }, { id: 'asc' }],
    include: {
      contract: { include: { tenant: true, local: true, document: true } },
      paymentLines: { include: { rentDue: true } },
    },
  });

  const sequence = new Map<number, number>();
  for (const payment of payments) {
    const year = payment.paymentDate.getUTCFullYear();
    const seq = (sequence.get(year) ?? 0) + 1;
    sequence.set(year, seq);
    const receiptNo = `REC-${year}-${String(seq).padStart(5, '0')}`;
    const s3Key = `receipts/${payment.id}/${receiptNo}.pdf`;

    const pdf = await buildReceiptPdf(
      payment,
      receiptNo,
      env('BAILLEUR_NAME')!,
      env('BAILLEUR_LIEU')!,
    );
    await s3.send(
      new PutObjectCommand({
        Bucket: env('S3_BUCKET'),
        Key: s3Key,
        Body: pdf,
        ContentType: 'application/pdf',
      }),
    );
    await prisma.receipt.create({
      data: {
        paymentId: payment.id,
        receiptNo,
        s3Key,
        createdAt: payment.paymentDate,
      },
    });
  }
  console.log(`✓ ${payments.length} reçus PDF`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
