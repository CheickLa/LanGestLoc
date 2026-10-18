import { PaymentMethod, PaymentType } from '@generated/prisma/client';
import PDFDocument from 'pdfkit';
import { buildReceiptPdf, type ReceiptPayment } from './pdf-builder';

const contract = {
  tenant: { name: 'Mamadou Diallo', phone: '+224621456789' },
  local: { name: 'Boutique A12' },
  document: { documentNo: 'BAIL-2026-00007' },
};
// Montants alternés : aucun mois ne se regroupe, un groupe par mois.
const rent = (months: number): ReceiptPayment => {
  const paymentLines = Array.from({ length: months }, (_, i) => ({
    rentDue: {
      month: new Date(Date.UTC(2024, i, 1)),
      amount: i % 2 ? 1600000 : 1500000,
    },
  }));
  return {
    type: PaymentType.RENT,
    amount: paymentLines.reduce((sum, l) => sum + l.rentDue.amount, 0),
    paymentMethod: PaymentMethod.ORANGE_MONEY,
    paymentDate: new Date('2026-10-17'),
    paymentLines,
    contract,
  };
};
const deposit = (type: PaymentType): ReceiptPayment => ({
  type,
  amount: 1500000,
  paymentMethod: PaymentMethod.CASH,
  paymentDate: new Date('2026-01-02'),
  paymentLines: [],
  contract,
});
const build = (payment: ReceiptPayment) =>
  buildReceiptPdf(payment, 'REC-2026-00042', 'Alpha Keita', 'Conakry, Kaloum');
const raw = (pdf: Buffer) => pdf.toString('latin1');
const pageCount = (pdf: Buffer) =>
  (raw(pdf).match(/\/Type \/Page(?!s)/g) ?? []).length;

describe('buildReceiptPdf', () => {
  it('produit un PDF A4', async () => {
    const pdf = await build(rent(2));
    expect(raw(pdf).startsWith('%PDF-')).toBe(true);
    expect(raw(pdf)).toContain('/MediaBox [0 0 595.28 841.89]');
  });

  it('tient sur une page pour deux groupes de mois', async () => {
    expect(pageCount(await build(rent(2)))).toBe(1);
  });

  it('continue le détail sur une autre page quand il est long', async () => {
    const pdf = await build(rent(30));
    const pages = pageCount(pdf);
    expect(pages).toBeGreaterThan(1);
    expect(pages).toBeLessThanOrEqual(5);
    expect(
      raw(pdf).match(/\/MediaBox \[0 0 595\.28 841\.89\]/g) ?? [],
    ).toHaveLength(pages);
  });

  it('porte le pied de page sur chaque page', async () => {
    const text = jest.spyOn(PDFDocument.prototype, 'text');
    const pdf = await build(rent(30));
    const drawn = text.mock.calls.map(([value]) => String(value));
    text.mockRestore();
    const pages = pageCount(pdf);
    expect(
      drawn.filter((v) => v === 'Ce reçu fait foi du paiement.'),
    ).toHaveLength(pages);
    expect(drawn.filter((v) => /^Page \d+ \/ \d+$/.test(v))).toEqual(
      Array.from({ length: pages }, (_, i) => `Page ${i + 1} / ${pages}`),
    );
  });

  it('garde le titre du détail sur la page de sa première ligne', async () => {
    const text = jest.spyOn(PDFDocument.prototype, 'text');
    const addPage = jest.spyOn(PDFDocument.prototype, 'addPage');
    const paymentLines = Array.from({ length: 15 }, (_, i) => ({
      rentDue: { month: new Date(Date.UTC(2025, i, 1)), amount: 3100000 },
    }));
    await build({
      ...rent(0),
      amount: 46500000,
      paymentLines,
      contract: {
        ...contract,
        tenant: {
          name: 'Établissements Commerciaux Fatoumata Binta Diallo-Barry et Frères SARL',
          phone: '+224621456789',
        },
        local: {
          name: 'Grand magasin du marché Madina, allée 3, rez-de-chaussée',
        },
      },
    });
    const orderOf = (value: string) =>
      text.mock.invocationCallOrder[
        text.mock.calls.findIndex(([v]) => v === value)
      ];
    const title = orderOf('Détail du paiement');
    const firstRow = orderOf('janvier 2025');
    const breaks = addPage.mock.invocationCallOrder.filter(
      (order) => order > title && order < firstRow,
    );
    text.mockRestore();
    addPage.mockRestore();
    expect(title).toBeDefined();
    expect(firstRow).toBeDefined();
    expect(breaks).toHaveLength(0);
  });

  it.each([PaymentType.DEPOSIT_HELD, PaymentType.DEPOSIT_REFUND])(
    'produit le reçu %s sur une page',
    async (type) => {
      expect(pageCount(await build(deposit(type)))).toBe(1);
    },
  );

  it('embarque Geist Sans et Geist Mono', async () => {
    const text = raw(await build(rent(2)));
    expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+Geist-/);
    expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+GeistMono-/);
  });
});
