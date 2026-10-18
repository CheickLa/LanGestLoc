import { PaymentMethod, PaymentType } from '@generated/prisma/client';
import { receiptContent, type ReceiptInput } from './receipt-content';

const line = (month: string, amount: number) => ({
  rentDue: { month: new Date(`${month}-01`), amount },
});
const contract = {
  tenant: { name: 'Mamadou Diallo', phone: '+224621456789' },
  local: { name: 'Boutique A12' },
  document: { documentNo: 'BAIL-2026-00007' },
};
const input = (
  payment: Partial<ReceiptInput['payment']> = {},
  issuedAt = new Date('2026-11-03T10:00:00Z'),
): ReceiptInput => ({
  payment: {
    type: PaymentType.RENT,
    amount: 1500000,
    paymentMethod: PaymentMethod.CASH,
    paymentDate: new Date('2026-11-03'),
    paymentLines: [line('2026-10', 1500000)],
    contract,
    ...payment,
  },
  receiptNo: 'REC-2026-00051',
  bailleur: 'Alpha Keita',
  lieu: 'Conakry, Kaloum',
  issuedAt,
});

describe('receiptContent', () => {
  it("loyer d'un mois", () => {
    expect(receiptContent(input())).toEqual({
      title: 'Reçu de paiement',
      receiptNo: 'REC-2026-00051',
      issuedOn: '03/11/2026',
      heroCaption: 'Montant payé',
      badge: { label: 'Payé', tone: 'success' },
      amount: '1 500 000',
      when: 'le 3 novembre 2026, en espèces',
      amountInWords: 'un million cinq cent mille francs guinéens',
      landlord: { name: 'Alpha Keita', detail: 'Conakry, Kaloum' },
      tenant: { name: 'Mamadou Diallo', phone: '+224 621 45 67 89' },
      facts: [
        { label: 'Local', value: 'Boutique A12', mono: false },
        { label: 'Contrat', value: 'BAIL-2026-00007', mono: true },
        { label: 'Mois payés', value: '1', mono: false },
      ],
      rows: [{ from: 'octobre 2026', to: null, detail: null, total: 1500000 }],
    });
  });

  it('loyer de sept mois avec une augmentation au 1er janvier', () => {
    const content = receiptContent(
      input({
        amount: 10900000,
        paymentMethod: PaymentMethod.ORANGE_MONEY,
        paymentDate: new Date('2026-10-17'),
        paymentLines: [
          ...['2026-08', '2026-09', '2026-10', '2026-11', '2026-12'].map((m) =>
            line(m, 1500000),
          ),
          line('2027-01', 1700000),
          line('2027-02', 1700000),
        ],
      }),
    );
    expect(content).toMatchObject({
      amount: '10 900 000',
      when: 'le 17 octobre 2026, par Orange Money',
      amountInWords: 'dix millions neuf cent mille francs guinéens',
      rows: [
        {
          from: 'août 2026',
          to: 'décembre 2026',
          detail: '5 mois × 1 500 000 GNF',
          total: 7500000,
        },
        {
          from: 'janvier 2027',
          to: 'février 2027',
          detail: '2 mois × 1 700 000 GNF',
          total: 3400000,
        },
      ],
    });
    expect(content.facts[2]).toEqual({
      label: 'Mois payés',
      value: '7',
      mono: false,
    });
  });

  it('caution versée', () => {
    const content = receiptContent(
      input({ type: PaymentType.DEPOSIT_HELD, paymentLines: [] }),
    );
    expect(content).toMatchObject({
      title: 'Reçu de caution',
      heroCaption: 'Caution versée',
      badge: null,
      rows: null,
    });
    expect(content.facts[2]).toEqual({
      label: 'Objet',
      value: 'Dépôt de caution',
      mono: false,
    });
  });

  it('caution restituée', () => {
    const content = receiptContent(
      input({ type: PaymentType.DEPOSIT_REFUND, paymentLines: [] }),
    );
    expect(content).toMatchObject({
      title: 'Restitution de caution',
      heroCaption: 'Caution restituée',
      badge: { label: 'Restituée', tone: 'neutral' },
      rows: null,
    });
    expect(content.facts[2]).toEqual({
      label: 'Objet',
      value: 'Restitution de la caution',
      mono: false,
    });
  });

  it.each([
    [PaymentMethod.CASH, 'le 3 novembre 2026, en espèces'],
    [PaymentMethod.ORANGE_MONEY, 'le 3 novembre 2026, par Orange Money'],
    [PaymentMethod.MOBILE_MONEY, 'le 3 novembre 2026, par Mobile Money'],
  ])('moyen %s', (paymentMethod, when) => {
    expect(receiptContent(input({ paymentMethod })).when).toBe(when);
  });

  it('écrit « 1er » le premier du mois', () => {
    expect(
      receiptContent(input({ paymentDate: new Date('2026-10-01') })).when,
    ).toBe('le 1er octobre 2026, en espèces');
  });

  it('lit les dates en UTC', () => {
    const content = receiptContent(
      input(
        { paymentDate: new Date('2026-10-31T23:30:00Z') },
        new Date('2026-12-31T23:59:00Z'),
      ),
    );
    expect(content.when).toBe('le 31 octobre 2026, en espèces');
    expect(content.issuedOn).toBe('31/12/2026');
  });

  it("met un tiret quand le bail n'a pas de document", () => {
    const content = receiptContent(
      input({ contract: { ...contract, document: null } }),
    );
    expect(content.facts[1]).toEqual({
      label: 'Contrat',
      value: '—',
      mono: false,
    });
  });

  it('laisse tel quel un téléphone étranger', () => {
    const content = receiptContent(
      input({
        contract: {
          ...contract,
          tenant: { name: 'Awa Traoré', phone: '+22370123456' },
        },
      }),
    );
    expect(content.tenant).toEqual({
      name: 'Awa Traoré',
      phone: '+22370123456',
    });
  });
});
