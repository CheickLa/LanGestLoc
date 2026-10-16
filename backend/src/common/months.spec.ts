import { firstOfMonth, isLastDayOfMonth } from './months';

describe('firstOfMonth', () => {
  it('ramène une date au 1er de son mois, à minuit UTC', () => {
    expect(firstOfMonth(new Date('2026-10-15T18:30:00Z'))).toEqual(
      new Date('2026-10-01'),
    );
  });

  it("décale d'un nombre de mois, en changeant d'année si besoin", () => {
    expect(firstOfMonth(new Date('2026-12-15'), 1)).toEqual(
      new Date('2027-01-01'),
    );
    expect(firstOfMonth(new Date('2027-01-10'), -1)).toEqual(
      new Date('2026-12-01'),
    );
  });
});

describe('isLastDayOfMonth', () => {
  it.each([
    '2026-10-31',
    '2026-09-30',
    '2026-12-31',
    '2027-02-28',
    '2028-02-29',
  ])('accepte %s', (day) => {
    expect(isLastDayOfMonth(new Date(day))).toBe(true);
  });

  it.each(['2026-10-01', '2026-10-30', '2028-02-28'])('refuse %s', (day) => {
    expect(isLastDayOfMonth(new Date(day))).toBe(false);
  });
});
