import { amountInWords } from './amount-in-words';

describe('amountInWords', () => {
  it.each([
    [1500000, 'un million cinq cent mille francs guinéens'],
    [10900000, 'dix millions neuf cent mille francs guinéens'],
    [2000000, 'deux millions de francs guinéens'],
    [1000000, 'un million de francs guinéens'],
    [850000, 'huit cent cinquante mille francs guinéens'],
    [80000, 'quatre-vingt mille francs guinéens'],
    [200000, 'deux cent mille francs guinéens'],
    [280000000, 'deux cent quatre-vingts millions de francs guinéens'],
    [71000, 'soixante et onze mille francs guinéens'],
    [21000, 'vingt et un mille francs guinéens'],
    [1091000, 'un million quatre-vingt-onze mille francs guinéens'],
    [1000, 'mille francs guinéens'],
    [100, 'cent francs guinéens'],
    [1, 'un franc guinéen'],
    [
      2147483647,
      'deux milliards cent quarante-sept millions quatre cent quatre-vingt-trois mille six cent quarante-sept francs guinéens',
    ],
  ])('%d : tableau de la spec', (amount, words) => {
    expect(amountInWords(amount)).toBe(words);
  });

  it.each([
    [2500000, 'deux millions cinq cent mille francs guinéens'],
    [1000000000, 'un milliard de francs guinéens'],
    [1001000, 'un million mille francs guinéens'],
    [200, 'deux cents francs guinéens'],
    [201, 'deux cent un francs guinéens'],
    [81, 'quatre-vingt-un francs guinéens'],
    [70, 'soixante-dix francs guinéens'],
    [17, 'dix-sept francs guinéens'],
    [99, 'quatre-vingt-dix-neuf francs guinéens'],
    [100000000, 'cent millions de francs guinéens'],
    [200000000, 'deux cents millions de francs guinéens'],
    [2000000000, 'deux milliards de francs guinéens'],
    [80, 'quatre-vingts francs guinéens'],
    [180, 'cent quatre-vingts francs guinéens'],
  ])("%d : règles d'accord", (amount, words) => {
    expect(amountInWords(amount)).toBe(words);
  });
});
