import { PaymentMethod, PaymentType } from '@generated/prisma/client';
import { formatPhone } from '@/common/pdf/phone';
import { amountInWords } from './amount-in-words';
import {
  formatMonth,
  groupDigits,
  groupReceiptLines,
  type ReceiptRow,
} from './receipt-rows';

export interface ReceiptInput {
  payment: {
    type: PaymentType;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentDate: Date;
    paymentLines: { rentDue: { month: Date; amount: number } }[];
    contract: {
      tenant: { name: string; phone: string };
      local: { name: string };
      document: { documentNo: string } | null;
    };
  };
  receiptNo: string;
  bailleur: string;
  lieu: string;
  issuedAt: Date;
}

export interface ReceiptFact {
  label: string;
  value: string;
  mono: boolean;
}

export interface ReceiptBadge {
  label: string;
  tone: 'success' | 'neutral';
}

export interface ReceiptContent {
  title: string;
  receiptNo: string;
  issuedOn: string;
  heroCaption: string;
  badge: ReceiptBadge | null;
  amount: string;
  when: string;
  amountInWords: string;
  landlord: { name: string; detail: string };
  tenant: { name: string; phone: string };
  facts: [ReceiptFact, ReceiptFact, ReceiptFact];
  rows: ReceiptRow[] | null;
}

const BY_TYPE: Record<
  PaymentType,
  {
    title: string;
    caption: string;
    badge: ReceiptBadge | null;
    object: string | null;
  }
> = {
  RENT: {
    title: 'Reçu de paiement',
    caption: 'Montant payé',
    badge: { label: 'Payé', tone: 'success' },
    object: null,
  },
  DEPOSIT_HELD: {
    title: 'Reçu de caution',
    caption: 'Caution versée',
    badge: null,
    object: 'Dépôt de caution',
  },
  DEPOSIT_REFUND: {
    title: 'Restitution de caution',
    caption: 'Caution restituée',
    badge: { label: 'Restituée', tone: 'neutral' },
    object: 'Restitution de la caution',
  },
};

const METHODS: Record<PaymentMethod, string> = {
  CASH: 'en espèces',
  ORANGE_MONEY: 'par Orange Money',
  MOBILE_MONEY: 'par Mobile Money',
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function issuedOn(date: Date): string {
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

function spokenDate(date: Date): string {
  const day = date.getUTCDate();
  return `le ${day === 1 ? '1er' : day} ${formatMonth(date)}`;
}

export function receiptContent(input: ReceiptInput): ReceiptContent {
  const { payment } = input;
  const { contract } = payment;
  const kind = BY_TYPE[payment.type];
  const documentNo = contract.document?.documentNo;

  return {
    title: kind.title,
    receiptNo: input.receiptNo,
    issuedOn: issuedOn(input.issuedAt),
    heroCaption: kind.caption,
    badge: kind.badge,
    amount: groupDigits(payment.amount),
    when: `${spokenDate(payment.paymentDate)}, ${METHODS[payment.paymentMethod]}`,
    amountInWords: amountInWords(payment.amount),
    landlord: { name: input.bailleur, detail: input.lieu },
    tenant: {
      name: contract.tenant.name,
      phone: formatPhone(contract.tenant.phone),
    },
    facts: [
      { label: 'Local', value: contract.local.name, mono: false },
      {
        label: 'Contrat',
        value: documentNo ?? '—',
        mono: documentNo !== undefined,
      },
      kind.object === null
        ? {
            label: 'Mois payés',
            value: String(payment.paymentLines.length),
            mono: false,
          }
        : { label: 'Objet', value: kind.object, mono: false },
    ],
    rows:
      payment.type === PaymentType.RENT
        ? groupReceiptLines(payment.paymentLines.map((l) => l.rentDue))
        : null,
  };
}
