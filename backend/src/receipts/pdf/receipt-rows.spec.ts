import { groupReceiptLines } from './receipt-rows';

const line = (month: string, amount = 1500000) => ({
  month: new Date(`${month}-01`),
  amount,
});
const augToOct = {
  from: 'août 2026',
  to: 'octobre 2026',
  detail: '3 × 1 500 000 GNF',
  total: 4500000,
};

describe('groupReceiptLines', () => {
  it('octobre 2026 seul : une ligne simple', () => {
    expect(groupReceiptLines([line('2026-10')])).toEqual([
      { from: 'octobre 2026', to: null, detail: null, total: 1500000 },
    ]);
  });

  it('août → octobre 2026 : une ligne de 3 mois', () => {
    expect(
      groupReceiptLines([line('2026-08'), line('2026-09'), line('2026-10')]),
    ).toEqual([augToOct]);
  });

  it('novembre 2026 → février 2027 avec augmentation au 01/2027 : deux lignes', () => {
    expect(
      groupReceiptLines([
        line('2026-11'),
        line('2026-12'),
        line('2027-01', 1700000),
        line('2027-02', 1700000),
      ]),
    ).toEqual([
      {
        from: 'novembre 2026',
        to: 'décembre 2026',
        detail: '2 × 1 500 000 GNF',
        total: 3000000,
      },
      {
        from: 'janvier 2027',
        to: 'février 2027',
        detail: '2 × 1 700 000 GNF',
        total: 3400000,
      },
    ]);
  });

  it('trie les lignes reçues dans le désordre', () => {
    expect(
      groupReceiptLines([line('2026-10'), line('2026-08'), line('2026-09')]),
    ).toEqual([augToOct]);
  });

  it('ne regroupe pas des mois qui ne se suivent pas', () => {
    expect(groupReceiptLines([line('2026-08'), line('2026-10')])).toEqual([
      { from: 'août 2026', to: null, detail: null, total: 1500000 },
      { from: 'octobre 2026', to: null, detail: null, total: 1500000 },
    ]);
  });
});
