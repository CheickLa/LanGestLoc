import PDFDocument from 'pdfkit';
import { COLOR } from '@/common/pdf/colors';
import { registerFonts, FontSet } from '@/common/pdf/fonts';
import { formatPhone } from '@/common/pdf/phone';
import { buildBailClauses, ClauseContext } from './bail-template';

export interface BailTenant {
  name: string;
  activity: string | null;
  phone: string;
  dateOfBirth: Date;
  birthPlace: string;
  idNumber: string;
}

export interface BailLocal {
  code: string;
  name: string;
}

export interface BailData {
  tenant: BailTenant;
  local: BailLocal;
  startDate: Date;
  endDate: Date | null;
  rentAmount: number;
  depositAmount: number;
}

// ── Géométrie page ──
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_BOTTOM = PAGE_H - 60; // Marge basse + espace pour pied de pages

// ── Helpers de formatage ──
function groupAmount(n: number): string {
  return n
    .toLocaleString('fr-FR', { maximumFractionDigits: 0 })
    .replace(/\s/g, ' ');
}

function amountText(n: number): string {
  return `${groupAmount(n)} GNF`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}

// Petite légende en capitales (Geist Mono) — rôles et libellés de la fiche.
function caption(
  doc: PDFKit.PDFDocument,
  F: FontSet,
  text: string,
  x: number,
  y: number,
  w: number,
  color: string,
  size = 7.5,
) {
  doc
    .font(F.monoRegular)
    .fontSize(size)
    .fillColor(color)
    .text(text.toUpperCase(), x, y, {
      width: w,
      characterSpacing: 0.5,
      lineBreak: false,
    });
}

export function buildBailPdf(
  data: BailData,
  documentNo: string,
  bailleur: string,
  lieu: string,
  representant?: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const F = registerFonts(doc);
    const today = formatDate(new Date());
    const periode = data.endDate
      ? `${formatDate(data.startDate)} — ${formatDate(data.endDate)}`
      : `À partir du ${formatDate(data.startDate)}`;

    // Masthead : titre + référence + filet bleu
    doc
      .font(F.sansSemiBold)
      .fontSize(21)
      .fillColor(COLOR.ink)
      .text('Contrat de location', MARGIN, MARGIN);
    const refY = doc.y + 6;
    doc
      .fontSize(9)
      .font(F.sansRegular)
      .fillColor(COLOR.faint)
      .text('Référence  ', MARGIN, refY, { continued: true })
      .font(F.monoRegular)
      .fillColor(COLOR.muted)
      .text(documentNo, { continued: true })
      .font(F.sansRegular)
      .fillColor(COLOR.faint)
      .text('    ·    Émis le  ', { continued: true })
      .font(F.monoRegular)
      .fillColor(COLOR.muted)
      .text(today, { continued: false });
    const ruleY = doc.y + 12;
    doc
      .lineWidth(1)
      .moveTo(MARGIN, ruleY)
      .lineTo(PAGE_W - MARGIN, ruleY)
      .strokeColor(COLOR.brand)
      .stroke();

    // ── Fiche : parties (haut blanc) + termes (bas soft) ──
    const cardX = MARGIN;
    const cardY = ruleY + 22;
    const cardW = CONTENT_W;
    const partiesH = 96;
    const termsH = 52;
    const cardH = partiesH + termsH;
    const termsY = cardY + partiesH;
    const colMid = cardX + cardW / 2;

    // Fonds, écrêtés au rayon de la carte
    doc.save();
    doc.roundedRect(cardX, cardY, cardW, cardH, 12).clip();
    doc.rect(cardX, cardY, cardW, cardH).fill(COLOR.white);
    doc.rect(cardX, termsY, cardW, termsH).fill(COLOR.soft);
    doc.restore();

    // Séparateurs internes
    doc.lineWidth(1).strokeColor(COLOR.line);
    doc.moveTo(colMid, cardY).lineTo(colMid, termsY).stroke(); // parties : vertical
    doc
      .moveTo(cardX, termsY)
      .lineTo(cardX + cardW, termsY)
      .stroke(); // termes : haut
    for (let i = 1; i < 4; i++) {
      const x = cardX + (cardW * i) / 4;
      doc
        .moveTo(x, termsY)
        .lineTo(x, cardY + cardH)
        .stroke();
    }
    // Bordure extérieure (par-dessus)
    doc
      .roundedRect(cardX, cardY, cardW, cardH, 12)
      .lineWidth(1)
      .strokeColor(COLOR.line)
      .stroke();

    // Colonne bailleur
    const lx = cardX + 16;
    const lw = cardW / 2 - 32;
    caption(doc, F, 'Bailleur', lx, cardY + 14, lw, COLOR.brand);
    doc
      .font(F.sansSemiBold)
      .fontSize(12.5)
      .fillColor(COLOR.ink)
      .text(bailleur, lx, cardY + 30, { width: lw });
    let ly = doc.y + 3;
    doc.font(F.sansRegular).fontSize(9).fillColor(COLOR.muted);
    if (representant) {
      doc.text(`représentés par ${representant}`, lx, ly, { width: lw });
      ly = doc.y + 1;
    }
    doc.text(lieu, lx, ly, { width: lw });

    // Colonne locataire
    const rx = colMid + 16;
    const rw = cardW / 2 - 32;
    caption(doc, F, 'Locataire', rx, cardY + 14, rw, COLOR.brand);
    doc
      .font(F.sansSemiBold)
      .fontSize(12.5)
      .fillColor(COLOR.ink)
      .text(data.tenant.name, rx, cardY + 30, { width: rw });
    let ry = doc.y + 3;
    doc
      .font(F.monoRegular)
      .fontSize(9)
      .fillColor(COLOR.muted)
      .text(formatPhone(data.tenant.phone), rx, ry, { width: rw });
    ry = doc.y + 1;
    doc
      .font(F.sansRegular)
      .fontSize(9)
      .fillColor(COLOR.muted)
      .text('Né(e) le ', rx, ry, { continued: true })
      .font(F.monoRegular)
      .text(formatDate(data.tenant.dateOfBirth), { continued: true })
      .font(F.sansRegular)
      .text(` à ${data.tenant.birthPlace}`, { continued: false });
    ry = doc.y + 1;
    doc
      .font(F.sansRegular)
      .fontSize(9)
      .fillColor(COLOR.muted)
      .text("Pièce d'identité ", rx, ry, { continued: true })
      .font(F.monoRegular)
      .text(data.tenant.idNumber, { continued: false });

    // Rangée des termes
    const cellW = cardW / 4;
    const term = (i: number, label: string) => {
      const cx = cardX + cellW * i + 14;
      const cw = cellW - 22;
      caption(doc, F, label, cx, termsY + 12, cw, COLOR.faint, 7);
      return { cx, cw, vy: termsY + 25 };
    };

    let t = term(0, 'Local');
    doc
      .font(F.sansMedium)
      .fontSize(10.5)
      .fillColor(COLOR.ink)
      .text(data.local.name, t.cx, t.vy, { width: t.cw });

    t = term(1, 'Période');
    doc
      .font(F.monoRegular)
      .fontSize(9)
      .fillColor(COLOR.ink)
      .text(periode, t.cx, t.vy, { width: t.cw });

    t = term(2, 'Loyer mensuel');
    doc
      .font(F.monoMedium)
      .fontSize(11)
      .fillColor(COLOR.ink)
      .text(groupAmount(data.rentAmount), t.cx, t.vy, { continued: true })
      .font(F.sansRegular)
      .fontSize(8)
      .fillColor(COLOR.faint)
      .text(' GNF', { continued: false });

    t = term(3, 'Dépôt de caution');
    doc
      .font(F.monoMedium)
      .fontSize(11)
      .fillColor(COLOR.ink)
      .text(groupAmount(data.depositAmount), t.cx, t.vy, { continued: true })
      .font(F.sansRegular)
      .fontSize(8)
      .fillColor(COLOR.faint)
      .text(' GNF', { continued: false });

    // ── Préambule ──
    doc.y = cardY + cardH + 22;
    doc.x = MARGIN;
    doc
      .font(F.sansRegular)
      .fontSize(10)
      .fillColor(COLOR.muted)
      .text(
        'Entre les soussignés, le Bailleur et le Locataire désignés ci-dessus, il a été convenu et arrêté ce qui suit :',
        MARGIN,
        doc.y,
        { width: CONTENT_W },
      );
    doc.y += 10;

    // ── Clauses ──
    const ctx: ClauseContext = {
      lieu,
      localName: data.local.name,
      rentAmount: amountText(data.rentAmount),
      depositAmount: amountText(data.depositAmount),
      startDate: formatDate(data.startDate),
      endDate: data.endDate ? formatDate(data.endDate) : null,
    };
    const gutter = 56;
    const textX = MARGIN + gutter;
    const textW = CONTENT_W - gutter;

    let first = true;
    buildBailClauses(ctx).forEach((c, i) => {
      doc.font(F.sansSemiBold).fontSize(10.5);
      const titleH = doc.heightOfString(c.title, { width: textW });
      doc.font(F.sansRegular).fontSize(10);
      const bodyH = doc.heightOfString(c.body, { width: textW });
      const sep = first ? 0 : 13;
      const blockH = sep + titleH + 4 + bodyH + 13;

      let broke = false;
      if (doc.y + blockH > CONTENT_BOTTOM) {
        doc.addPage();
        broke = true;
      }
      if (!first && !broke) {
        doc
          .moveTo(MARGIN, doc.y)
          .lineTo(MARGIN + CONTENT_W, doc.y)
          .lineWidth(1)
          .strokeColor(COLOR.line)
          .stroke();
        doc.y += 13;
      }
      const rowY = doc.y;
      doc
        .font(F.monoMedium)
        .fontSize(9)
        .fillColor(COLOR.brand)
        .text(`Art. ${i + 1}`, MARGIN, rowY + 1, {
          width: gutter - 8,
          lineBreak: false,
        });
      doc
        .font(F.sansSemiBold)
        .fontSize(10.5)
        .fillColor(COLOR.ink)
        .text(c.title, textX, rowY, { width: textW });
      doc
        .font(F.sansRegular)
        .fontSize(10)
        .fillColor(COLOR.ink)
        .text(c.body, textX, doc.y + 4, { width: textW, align: 'justify' });
      doc.y += 13;
      first = false;
    });

    // ── Signatures ──
    if (doc.y + 96 > CONTENT_BOTTOM) doc.addPage();
    doc.y += 18;
    doc
      .font(F.sansRegular)
      .fontSize(9.5)
      .fillColor(COLOR.muted)
      .text(
        `Fait à ${lieu}, le ${today}, en deux exemplaires originaux.`,
        MARGIN,
        doc.y,
        { width: CONTENT_W },
      );
    doc.y += 26;

    const gridY = doc.y;
    const gw = CONTENT_W / 4;
    const signCells: Array<[string, string | null]> = [
      ['Le bailleur', bailleur],
      ['Le locataire', data.tenant.name],
      ['Témoin 1', null],
      ['Témoin 2', null],
    ];
    signCells.forEach(([role, name], i) => {
      const gx = MARGIN + gw * i;
      const cw = gw - 16;
      caption(doc, F, role, gx, gridY, cw, COLOR.faint, 7.5);
      const lineY = gridY + 44;
      doc
        .moveTo(gx, lineY)
        .lineTo(gx + cw, lineY)
        .lineWidth(1)
        .strokeColor(COLOR.ink)
        .stroke();
      if (name) {
        doc
          .font(F.sansMedium)
          .fontSize(9)
          .fillColor(COLOR.ink)
          .text(name, gx, lineY + 6, { width: cw });
      } else {
        doc
          .font(F.sansRegular)
          .fontSize(9)
          .fillColor(COLOR.faint)
          .text('Nom & signature', gx, lineY + 6, { width: cw });
      }
    });

    // ── Pied de page sur chaque page : documentNo + Page X / Y ──
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Neutraliser la marge basse : écrire le pied sans déclencher de saut de page.
      doc.page.margins.bottom = 0;
      const fy = PAGE_H - 34;
      doc
        .font(F.monoRegular)
        .fontSize(7.5)
        .fillColor(COLOR.faint)
        .text(documentNo, MARGIN, fy, {
          width: CONTENT_W / 2,
          lineBreak: false,
        });
      doc
        .font(F.sansRegular)
        .fontSize(7.5)
        .fillColor(COLOR.faint)
        .text(`Page ${i - range.start + 1} / ${range.count}`, MARGIN, fy, {
          width: CONTENT_W,
          align: 'right',
        });
    }

    doc.end();
  });
}
