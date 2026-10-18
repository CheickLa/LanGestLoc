import { RentDueStatus } from '@generated/prisma/client';
import { monthsBetween } from '@/common/months';
import {
  lastPayableMonth,
  payableMonths,
  type PayableMonth,
} from './payable-months';

const NOW = new Date('2026-10-17T10:00:00Z');
const RENT = 1500000;
const rent = {
  id: 7,
  amount: RENT,
  effectiveFrom: new Date('2026-01-01'),
  effectiveTo: null,
};
const ym = (d: Date) => d.toISOString().slice(0, 7);
const range = (from: string, to: string) =>
  monthsBetween(new Date(`${from}-01`), new Date(`${to}-01`));
// id = AAAAMM, pour lire l'échéance d'un mois sans dépendre de l'ordre des tests
const dues = (from: string, to: string, status: RentDueStatus, amount = RENT) =>
  range(from, to).map((month) => ({
    id: Number(ym(month).replace('-', '')),
    rentId: 7,
    month,
    amount,
    status,
  }));
const period = (startDate: string, endDate: string | null = null) => ({
  startDate: new Date(startDate),
  endDate: endDate ? new Date(endDate) : null,
});
const view = (months: PayableMonth[]) =>
  months.map((m) => `${ym(m.month)} ${m.status} ${m.amount}`);
const advance = (from: string, to: string, amount = RENT) =>
  range(from, to).map((m) => `${ym(m)} ADVANCE ${amount}`);
const paidUntilJuly = dues('2026-01', '2026-07', RentDueStatus.PAID);
const augToOct = [
  ...dues('2026-08', '2026-09', RentDueStatus.LATE),
  ...dues('2026-10', '2026-10', RentDueStatus.PENDING),
];
const dueAugToOct = [
  `2026-08 LATE ${RENT}`,
  `2026-09 LATE ${RENT}`,
  `2026-10 PENDING ${RENT}`,
];

describe('lastPayableMonth', () => {
  it('va à 12 mois après le mois en cours sans fin de contrat', () => {
    expect(lastPayableMonth(null, NOW)).toEqual(new Date('2027-10-01'));
  });
  it("s'arrête au mois de fin s'il arrive avant", () => {
    expect(lastPayableMonth(new Date('2026-12-31'), NOW)).toEqual(
      new Date('2026-12-01'),
    );
  });
  it('garde la limite de 12 mois quand la fin est plus loin', () => {
    expect(lastPayableMonth(new Date('2028-06-30'), NOW)).toEqual(
      new Date('2027-10-01'),
    );
  });
});

describe('payableMonths', () => {
  it("payé jusqu'à juillet : août et septembre en retard, octobre en attente, puis 12 mois à l'avance", () => {
    const months = payableMonths(
      period('2026-01-01'),
      [...paidUntilJuly, ...augToOct],
      [rent],
      NOW,
    );
    expect(view(months)).toEqual([
      ...dueAugToOct,
      ...advance('2026-11', '2027-10'),
    ]);
    expect(months[0]).toMatchObject({ rentDueId: 202608, rentId: 7 });
    expect(months[3]).toMatchObject({ rentDueId: null, rentId: 7 });
  });

  it("payé jusqu'à octobre : novembre 2026 → octobre 2027, tous à l'avance", () => {
    const months = payableMonths(
      period('2026-01-01'),
      dues('2026-01', '2026-10', RentDueStatus.PAID),
      [rent],
      NOW,
    );
    expect(view(months)).toEqual(advance('2026-11', '2027-10'));
  });

  it("fin 12/2026 : août → décembre, novembre et décembre à l'avance", () => {
    const months = payableMonths(
      period('2026-01-01', '2026-12-31'),
      [...paidUntilJuly, ...augToOct],
      [rent],
      NOW,
    );
    expect(view(months)).toEqual([
      ...dueAugToOct,
      ...advance('2026-11', '2026-12'),
    ]);
  });

  it("fin 10/2026 : août → octobre, rien à l'avance", () => {
    const months = payableMonths(
      period('2026-01-01', '2026-10-31'),
      [...paidUntilJuly, ...augToOct],
      [rent],
      NOW,
    );
    expect(view(months)).toEqual(dueAugToOct);
  });

  it('début 01/2025, fin 09/2026, rien de payé : les 21 mois en retard', () => {
    const months = payableMonths(
      period('2025-01-01', '2026-09-30'),
      dues('2025-01', '2026-09', RentDueStatus.LATE),
      [{ ...rent, effectiveFrom: new Date('2025-01-01') }],
      NOW,
    );
    expect(view(months)).toEqual(
      range('2025-01', '2026-09').map((m) => `${ym(m)} LATE ${RENT}`),
    );
    expect(months).toHaveLength(21);
  });

  it("contrat pas commencé (début 12/2026) : décembre 2026 → octobre 2027, tous à l'avance", () => {
    const months = payableMonths(
      period('2026-12-01'),
      [],
      [{ ...rent, effectiveFrom: new Date('2026-12-01') }],
      NOW,
    );
    expect(view(months)).toEqual(advance('2026-12', '2027-10'));
  });

  it('début 11/2027 : aucun mois, après la limite', () => {
    expect(
      payableMonths(
        period('2027-11-01'),
        [],
        [{ ...rent, effectiveFrom: new Date('2027-11-01') }],
        NOW,
      ),
    ).toEqual([]);
  });

  it('augmentation à 1 700 000 au 01/2027 : janvier 2027 et suivants au nouveau loyer', () => {
    const rents = [
      { ...rent, effectiveTo: new Date('2026-12-31') },
      {
        id: 8,
        amount: 1700000,
        effectiveFrom: new Date('2027-01-01'),
        effectiveTo: null,
      },
    ];
    const months = payableMonths(
      period('2026-01-01'),
      dues('2026-01', '2026-10', RentDueStatus.PAID),
      rents,
      NOW,
    );
    expect(view(months)).toEqual([
      ...advance('2026-11', '2026-12'),
      ...advance('2027-01', '2027-10', 1700000),
    ]);
    expect(months[2]).toMatchObject({ rentId: 8, rentDueId: null });
  });

  it('mois sans échéance avant le mois en cours (cron manqué) : statut initial', () => {
    const months = payableMonths(
      period('2026-01-01'),
      paidUntilJuly,
      [rent],
      NOW,
    );
    expect(view(months).slice(0, 3)).toEqual(dueAugToOct);
    expect(months[0].rentDueId).toBeNull();
  });

  it("mois futur déjà généré à la main : à l'avance, avec son échéance", () => {
    const months = payableMonths(
      period('2026-01-01'),
      [
        ...paidUntilJuly,
        ...augToOct,
        ...dues('2026-11', '2026-11', RentDueStatus.PENDING),
      ],
      [rent],
      NOW,
    );
    expect(months[3]).toMatchObject({ status: 'ADVANCE', rentDueId: 202611 });
  });

  it("garde le montant figé d'une échéance existante", () => {
    const months = payableMonths(
      period('2026-01-01'),
      [
        ...paidUntilJuly,
        ...dues('2026-08', '2026-08', RentDueStatus.LATE, 1400000),
      ],
      [rent],
      NOW,
    );
    expect(months[0].amount).toBe(1400000);
  });
});
