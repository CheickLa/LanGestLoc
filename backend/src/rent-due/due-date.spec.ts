import { dueDateOf } from './due-date';

describe('dueDateOf', () => {
  it('tombe le 5 du mois suivant', () => {
    expect(dueDateOf(new Date('2026-04-01'))).toEqual(new Date('2026-05-05'));
  });

  it("passe à l'année suivante pour décembre", () => {
    expect(dueDateOf(new Date('2026-12-01'))).toEqual(new Date('2027-01-05'));
  });
});
