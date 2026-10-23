import PDFDocument from 'pdfkit';
import { LOCAL_NAME_MAX_LENGTH } from '@/locals/dto/create-local.dto';
import { TENANT_NAME_MAX_LENGTH } from '@/tenants/dto/create-tenant.dto';
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

  describe.each([
    [
      'en capitales',
      (n: number) => 'ÉTABLISSEMENTS DIALLO ET FRÈRES '.repeat(3).slice(0, n),
    ],
    ['sans espace', (n: number) => 'W'.repeat(n)],
  ])('avec des noms à la limite, %s', (_, nameOf) => {
    const long: BailData = {
      ...data,
      tenant: { ...data.tenant, name: nameOf(TENANT_NAME_MAX_LENGTH) },
      local: { ...data.local, name: nameOf(LOCAL_NAME_MAX_LENGTH) },
    };
    const CONTENT_W = 595.28 - 48 * 2;
    const FOOTER_TOP = 841.89 - 34;

    async function render() {
      const drawn: {
        value: string;
        startPage: PDFKit.PDFPage;
        endPage: PDFKit.PDFPage;
        bottom: number;
      }[] = [];
      const { text } = PDFDocument.prototype as PDFKit.PDFDocument;
      const textSpy = jest
        .spyOn(PDFDocument.prototype, 'text')
        .mockImplementation(function (
          this: PDFKit.PDFDocument,
          ...args: Parameters<PDFKit.PDFDocument['text']>
        ) {
          const startPage = this.page;
          text.apply(this, args);
          drawn.push({
            value: String(args[0]),
            startPage,
            endPage: this.page,
            bottom: this.y,
          });
          return this;
        });
      const rectSpy = jest.spyOn(PDFDocument.prototype, 'rect');
      await buildBailPdf(long, 'BAIL-2026-00007', 'Alpha Keita', 'Conakry');
      const [card, terms] = rectSpy.mock.calls
        .filter(([x, , w]) => x === 48 && w === CONTENT_W)
        .map(([, y, , h]) => ({
          top: Number(y),
          bottom: Number(y) + Number(h),
        }));
      textSpy.mockRestore();
      rectSpy.mockRestore();
      const bottomOf = (value: string) =>
        drawn.find((d) => d.value === value)?.bottom ?? Infinity;
      return { drawn, card, terms, bottomOf };
    }

    it('garde la colonne du locataire au-dessus des termes', async () => {
      const { terms, bottomOf } = await render();
      expect(bottomOf(long.tenant.idNumber)).toBeLessThanOrEqual(terms.top);
    });

    it('garde le nom du local dans la fiche', async () => {
      const { card, bottomOf } = await render();
      expect(bottomOf(long.local.name)).toBeLessThanOrEqual(card.bottom);
    });

    it('écrit chaque texte sur sa page, au-dessus du pied de page', async () => {
      const { drawn } = await render();
      const body = drawn.filter(
        (d) => d.value !== 'BAIL-2026-00007' && !d.value.startsWith('Page '),
      );
      for (const d of body) {
        expect(d.endPage).toBe(d.startPage);
        expect(d.bottom).toBeLessThanOrEqual(FOOTER_TOP);
      }
    });
  });
});
