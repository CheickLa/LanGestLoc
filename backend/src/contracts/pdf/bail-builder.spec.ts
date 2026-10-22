import PDFDocument from 'pdfkit';
import { buildBailPdf, type BailData } from './bail-builder';

const data: BailData = {
  tenant: {
    name: 'Mamadou Diallo',
    activity: 'Commerce de tissus',
    phone: '+224621456789',
    dateOfBirth: new Date('1985-04-12'),
    birthPlace: 'Conakry',
    idNumber: 'GN-123456',
  },
  local: { code: 'A12', name: 'Boutique A12' },
  startDate: new Date('2026-01-01'),
  endDate: null,
  rentAmount: 1500000,
  depositAmount: 1500000,
};

describe('buildBailPdf', () => {
  it('porte le logo LanGestLoc en haut à droite, sur la ligne du titre', async () => {
    const text = jest.spyOn(PDFDocument.prototype, 'text');
    await buildBailPdf(data, 'BAIL-2026-00007', 'Alpha Keita', 'Conakry');
    const calls = text.mock.calls.map(([value, x, y]) => ({
      value: String(value),
      x: Number(x),
      y: Number(y),
    }));
    text.mockRestore();
    const title = calls.find((c) => c.value === 'Contrat de location');
    const brand = calls.filter((c) => c.value === 'LanGestLoc');
    expect(brand).toHaveLength(1);
    expect(brand[0].x).toBeGreaterThan(595.28 / 2);
    expect(Math.abs(brand[0].y - (title?.y ?? 0))).toBeLessThan(10);
  });

  it('pose chaque montant et son « GNF » sur la même ligne de base', async () => {
    const text = jest.spyOn(PDFDocument.prototype, 'text');
    await buildBailPdf(data, 'BAIL-2026-00007', 'Alpha Keita', 'Conakry');
    const calls = text.mock.calls.map(([value, x, y, options]) => ({
      value: String(value),
      x: Number(x),
      y: Number(y),
      baseline: (options as { baseline?: unknown } | undefined)?.baseline,
    }));
    text.mockRestore();
    const currencies = calls.flatMap((c, i) =>
      c.value === 'GNF' ? [{ currency: c, amount: calls[i - 1] }] : [],
    );
    expect(currencies).toHaveLength(2);
    for (const { currency, amount } of currencies) {
      expect(amount.value).toMatch(/^1\s500\s000$/);
      expect(amount.baseline).toBe('alphabetic');
      expect(currency.baseline).toBe('alphabetic');
      expect(currency.y).toBe(amount.y);
      expect(currency.x).toBeGreaterThan(amount.x);
    }
  });
});
