import { dueDateOf, initialStatusOf } from './due-date';
import { RentDueStatus } from '@generated/prisma/client';

describe('initialStatusOf', () => {
  const now = new Date('2026-10-17T10:00:00Z');

  it('en attente quand la date limite est à venir', () => {
    expect(initialStatusOf(new Date('2026-11-05'), now)).toBe(
      RentDueStatus.PENDING,
    );
  });

  it('en retard quand la date limite est passée', () => {
    expect(initialStatusOf(new Date('2026-10-05'), now)).toBe(
      RentDueStatus.LATE,
    );
  });

  it("en attente à l'instant même de la date limite, comme le cron", () => {
    expect(
      initialStatusOf(new Date('2026-10-05'), new Date('2026-10-05T00:00:00Z')),
    ).toBe(RentDueStatus.PENDING);
  });

  it('en retard le 5 dans la journée, comme le cron de minuit', () => {
    expect(
      initialStatusOf(new Date('2026-10-05'), new Date('2026-10-05T10:00:00Z')),
    ).toBe(RentDueStatus.LATE);
  });
});

describe('dueDateOf', () => {
  it('tombe le 5 du mois suivant', () => {
    expect(dueDateOf(new Date('2026-04-01'))).toEqual(new Date('2026-05-05'));
  });

  it("passe à l'année suivante pour décembre", () => {
    expect(dueDateOf(new Date('2026-12-01'))).toEqual(new Date('2027-01-05'));
  });
});
