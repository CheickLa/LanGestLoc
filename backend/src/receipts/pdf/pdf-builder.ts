import PDFDocument from 'pdfkit';

// ── Types ──

interface ReceiptTenant {
  name: string;
  phone?: string;
}

interface ReceiptLocal {
  name: string;
}

interface ReceiptRentDue {
  month: Date;
  amount: number | { toNumber: () => number };
}

interface ReceiptPaymentLine {
  rentDue: ReceiptRentDue;
}

interface ReceiptPayment {
  contract: {
    tenant: ReceiptTenant;
    local: ReceiptLocal;
  };
  paymentLines: ReceiptPaymentLine[];
  amount: number | { toNumber: () => number };
  paymentMethod: string | null;
  paymentDate: Date | string;
  type: string;
}

// ── Constantes de mise en page ──

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 90;
const FOOTER_H = 48;

const FONT = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
} as const;

const COLOR = {
  green700: '#0F6E56',
  green500: '#1D9E75',
  green300: '#5DCAA5',
  green50: '#E1F5EE',
  gray50: '#F5F5F4',
  gray200: '#E0DED8',
  gray400: '#888780',
  gray600: '#5F5E5A',
  black: '#1A1A18',
} as const;

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  MOBILE_MONEY: 'Mobile Money',
};

const TYPE_TITLES: Record<string, string> = {
  RENT: 'REÇU DE PAIEMENT',
  DEPOSIT_HELD: 'REÇU DE CAUTION',
  DEPOSIT_REFUND: 'REMBOURSEMENT DE CAUTION',
};

// ── Helpers de formatage ──

function formatMonth(date: Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatAmount(n: number | { toNumber: () => number }): string {
  const val = typeof n === 'object' ? n.toNumber() : n;
  return val.toLocaleString('fr-FR').replace(/\s/g, ' ') + ' GNF';
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR');
}

// ── Helpers PDF ──

function labelText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  options?: PDFKit.Mixins.TextOptions,
) {
  doc
    .font(FONT.regular)
    .fontSize(7.5)
    .fillColor(COLOR.gray400)
    .text(text.toUpperCase(), x, y, { characterSpacing: 1, ...options });
}

function divider(doc: PDFKit.PDFDocument, y: number, width = 0.5) {
  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE_W - MARGIN, y)
    .strokeColor(COLOR.gray200)
    .lineWidth(width)
    .stroke();
}

// ── Sections du PDF ──

function drawHeader(doc: PDFKit.PDFDocument, receiptNo: string, type: string) {
  doc.rect(0, 0, PAGE_W, HEADER_H).fill(COLOR.green700);

  doc
    .font(FONT.regular)
    .fontSize(8)
    .fillColor(COLOR.green300)
    .text(TYPE_TITLES[type] ?? 'REÇU DE PAIEMENT', MARGIN, 22, { characterSpacing: 1.5 });

  doc
    .font(FONT.bold)
    .fontSize(20)
    .fillColor(COLOR.green50)
    .text(`N° ${receiptNo}`, MARGIN, 34);

  doc
    .font(FONT.regular)
    .fontSize(7.5)
    .fillColor(COLOR.green300)
    .text('ÉMIS LE', 0, 24, { align: 'right', width: PAGE_W - MARGIN, characterSpacing: 1 });

  doc
    .font(FONT.regular)
    .fontSize(11)
    .fillColor(COLOR.green50)
    .text(formatDate(new Date()), 0, 36, { align: 'right', width: PAGE_W - MARGIN });
}

function drawParties(
  doc: PDFKit.PDFDocument,
  bailleur: string,
  tenant: ReceiptTenant,
  y: number,
): number {
  labelText(doc, 'Bailleur', MARGIN, y);
  labelText(doc, 'Locataire', MARGIN, y, { align: 'right', width: CONTENT_W });
  y += 14;

  doc.font(FONT.bold).fontSize(11).fillColor(COLOR.black);
  doc.text(bailleur, MARGIN, y, { width: CONTENT_W / 2 - 10 });

  doc.font(FONT.bold).fontSize(11).fillColor(COLOR.black);
  doc.text(tenant.name, MARGIN, y, { align: 'right', width: CONTENT_W });

  if (tenant.phone) {
    doc
      .font(FONT.regular)
      .fontSize(10)
      .fillColor(COLOR.gray600)
      .text(tenant.phone, MARGIN, y + 14, { align: 'right', width: CONTENT_W });
  }

  y += 44;
  divider(doc, y);
  return y + 16;
}

function drawLocal(doc: PDFKit.PDFDocument, local: ReceiptLocal, lieu: string, y: number): number {
  doc.rect(MARGIN, y, 3, 28).fill(COLOR.green500);

  labelText(doc, 'Local', MARGIN + 12, y + 2);
  doc
    .font(FONT.bold)
    .fontSize(11)
    .fillColor(COLOR.black)
    .text(`${local.name} — ${lieu}`, MARGIN + 12, y + 14, { width: CONTENT_W - 12 });

  y += 44;
  divider(doc, y);
  return y + 16;
}

function drawPaymentLines(
  doc: PDFKit.PDFDocument,
  lines: ReceiptPaymentLine[],
  totalAmount: number | { toNumber: () => number },
  type: string,
  y: number,
): number {
  labelText(doc, 'Détail du paiement', MARGIN, y);
  y += 22;

  const isDepositOnly = type === 'DEPOSIT_REFUND' || type === 'DEPOSIT_HELD';
  const leftHeader = isDepositOnly ? 'Objet' : 'Période';
  doc
    .font(FONT.regular)
    .fontSize(9)
    .fillColor(COLOR.gray400)
    .text(leftHeader, MARGIN, y)
    .text('Montant', 0, y, { align: 'right', width: PAGE_W - MARGIN });
  y += 12;
  divider(doc, y);
  y += 10;

  if (isDepositOnly) {
    const objectLabel =
      type === 'DEPOSIT_HELD' ? 'Versement de la caution' : 'Restitution de la caution';
    doc.font(FONT.regular).fontSize(11).fillColor(COLOR.black);
    doc.text(objectLabel, MARGIN, y);
    doc.text(formatAmount(totalAmount), 0, y, { align: 'right', width: PAGE_W - MARGIN });
    y += 22;
    divider(doc, y - 4, 0.3);
  } else {
    for (const pl of lines) {
      doc.font(FONT.regular).fontSize(11).fillColor(COLOR.black);
      doc.text(formatMonth(pl.rentDue.month), MARGIN, y);
      doc.text(formatAmount(pl.rentDue.amount), 0, y, { align: 'right', width: PAGE_W - MARGIN });
      y += 22;
      divider(doc, y - 4, 0.3);
    }
  }

  y += 4;

  const totalLabel =
    type === 'DEPOSIT_REFUND'
      ? 'TOTAL REMBOURSÉ'
      : type === 'DEPOSIT_HELD'
        ? 'TOTAL ENCAISSÉ'
        : 'TOTAL PAYÉ';
  doc
    .font(FONT.bold)
    .fontSize(9)
    .fillColor(COLOR.gray600)
    .text(totalLabel, MARGIN, y + 4);
  doc
    .font(FONT.bold)
    .fontSize(18)
    .fillColor(COLOR.green700)
    .text(formatAmount(totalAmount), 0, y, { align: 'right', width: PAGE_W - MARGIN });

  y += 36;
  divider(doc, y);
  return y + 16;
}

function drawPaymentInfo(
  doc: PDFKit.PDFDocument,
  method: string | null,
  date: Date | string,
  y: number,
) {
  doc.rect(MARGIN, y, CONTENT_W, 50).fill(COLOR.gray50).stroke();

  labelText(doc, 'Méthode de paiement', MARGIN + 12, y + 8);
  const methodLabel = method ? (METHOD_LABELS[method] ?? method) : '—';
  doc
    .font(FONT.bold)
    .fontSize(11)
    .fillColor(COLOR.black)
    .text(methodLabel, MARGIN + 12, y + 20);

  labelText(doc, 'Date du paiement', MARGIN, y + 8, {
    align: 'right',
    width: CONTENT_W - 12,
  });
  doc
    .font(FONT.bold)
    .fontSize(11)
    .fillColor(COLOR.black)
    .text(formatDate(date), MARGIN, y + 20, { align: 'right', width: CONTENT_W - 12 });
}

function drawFooter(doc: PDFKit.PDFDocument) {
  const footerY = PAGE_H - FOOTER_H;

  doc.rect(0, footerY, PAGE_W, FOOTER_H).fill(COLOR.gray50);
  doc
    .moveTo(0, footerY)
    .lineTo(PAGE_W, footerY)
    .strokeColor(COLOR.gray200)
    .lineWidth(0.5)
    .stroke();

  doc
    .font(FONT.regular)
    .fontSize(8.5)
    .fillColor(COLOR.gray600)
    .text('Ce reçu est généré automatiquement et fait foi de paiement.', 0, footerY + 10, {
      align: 'center',
      width: PAGE_W,
    });

  doc
    .font(FONT.regular)
    .fontSize(8.5)
    .fillColor(COLOR.gray400)
    .text('LanGestLoc', 0, footerY + 24, { align: 'center', width: PAGE_W });
}

// ── Point d'entrée ──

export function buildReceiptPdf(
  payment: ReceiptPayment,
  receiptNo: string,
  bailleur: string,
  lieu: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { tenant, local } = payment.contract;

    drawHeader(doc, receiptNo, payment.type);
    let y = HEADER_H + 28;
    y = drawParties(doc, bailleur, tenant, y);
    y = drawLocal(doc, local, lieu, y);
    y = drawPaymentLines(doc, payment.paymentLines, payment.amount, payment.type, y);
    drawPaymentInfo(doc, payment.paymentMethod, payment.paymentDate, y);
    drawFooter(doc);

    doc.end();
  });
}
