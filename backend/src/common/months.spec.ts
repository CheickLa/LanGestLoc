import { firstOfMonth, isLastDayOfMonth, monthsBetween } from './months';

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

describe('monthsBetween', () => {
  it('liste les mois du premier au dernier, inclus', () => {
    expect(
      monthsBetween(new Date('2026-01-01'), new Date('2026-03-01')),
    ).toEqual([
      new Date('2026-01-01'),
      new Date('2026-02-01'),
      new Date('2026-03-01'),
    ]);
  });

  it("passe d'une année à l'autre", () => {
    expect(
      monthsBetween(new Date('2026-12-01'), new Date('2027-01-01')),
    ).toEqual([new Date('2026-12-01'), new Date('2027-01-01')]);
  });

  it('renvoie un seul mois quand les bornes sont dans le même mois', () => {
    expect(
      monthsBetween(new Date('2026-10-01'), new Date('2026-10-01')),
    ).toEqual([new Date('2026-10-01')]);
  });

  it('renvoie une liste vide quand le début est après la fin', () => {
    expect(
      monthsBetween(new Date('2026-11-01'), new Date('2026-10-01')),
    ).toEqual([]);
  });

  it('couvre plusieurs années sans sauter de mois', () => {
    const months = monthsBetween(
      new Date('2015-03-01'),
      new Date('2026-10-01'),
    );
    expect(months).toHaveLength(140);
    expect(months[0]).toEqual(new Date('2015-03-01'));
    expect(months[139]).toEqual(new Date('2026-10-01'));
  });
});
