import PDFDocument from 'pdfkit';
import { COLOR } from '@/common/pdf/colors';
import { registerFonts, type FontSet } from '@/common/pdf/fonts';
import { drawLogo } from '@/common/pdf/logo';
import {
  receiptContent,
  type ReceiptBadge,
  type ReceiptContent,
  type ReceiptFact,
  type ReceiptInput,
} from './receipt-content';
import { groupDigits, type ReceiptRow } from './receipt-rows';

export type ReceiptPayment = ReceiptInput['payment'];

type Doc = PDFKit.PDFDocument;
type TextOptions = PDFKit.Mixins.TextOptions;

// ── Géométrie : grille au format A5, agrandie à l'A4 (mêmes proportions) ──
const SCALE = Math.SQRT2;
const PAGE_W = 595.28 / SCALE;
const PAGE_H = 841.89 / SCALE;
const MARGIN_X = 28;
const MARGIN_TOP = 30;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const BLOCK_GAP = 14;
// Boîte du logo ; le carré de l'icône en occupe 88 %.
const LOGO_BOX = 18;
const LOGO = LOGO_BOX * 0.88;
const HERO_PAD_X = 18;
const HERO_PAD_TOP = 13;
const HERO_PAD_BOTTOM = 12;
const CELL_PAD_X = 16;
const PARTY_PAD_TOP = 11;
const PARTY_PAD_BOTTOM = 12;
const FACT_PAD_TOP = 8;
const FACT_PAD_BOTTOM = 9;
const HEAD_PAD_Y = 5;
const ROW_PAD_Y = 7;
const ROW_DETAIL_GAP = 2;
const CHECK = 7;

// ── Styles de texte ──
const LINE_HEIGHT = 1.35;

interface Style {
  font: keyof FontSet;
  size: number;
  color: string;
  lineHeight?: number;
  spacing?: number;
  tnum?: boolean;
}

const TITLE: Style = {
  font: 'sansSemiBold',
  size: 21,
  color: COLOR.ink,
  lineHeight: 1.1,
  spacing: -0.4,
};
const META: Style = { font: 'sansRegular', size: 8, color: COLOR.faint };
const META_VALUE: Style = { font: 'monoRegular', size: 8, color: COLOR.muted };
const BRAND: Style = {
  font: 'sansSemiBold',
  size: 10.5,
  color: COLOR.ink,
  spacing: -0.1,
};
const CAPTION: Style = {
  font: 'monoRegular',
  size: 6.8,
  color: COLOR.brand,
  spacing: 0.5,
};
const BADGE: Style = { font: 'sansMedium', size: 7.8, color: COLOR.ink };
const AMOUNT: Style = {
  font: 'sansSemiBold',
  size: 30,
  color: COLOR.ink,
  lineHeight: 1,
  spacing: -0.9,
  tnum: true,
};
const CURRENCY: Style = { font: 'sansMedium', size: 12, color: COLOR.faint };
const WHEN: Style = { font: 'sansRegular', size: 9, color: COLOR.muted };
const WORDS: Style = {
  font: 'sansRegular',
  size: 8.4,
  color: COLOR.muted,
  lineHeight: 1.5,
};
const WORDS_SUM: Style = { ...WORDS, font: 'sansMedium', color: COLOR.ink };
const NAME: Style = {
  font: 'sansSemiBold',
  size: 12,
  color: COLOR.ink,
  spacing: -0.1,
};
const DETAIL: Style = { font: 'sansRegular', size: 8.6, color: COLOR.muted };
const DETAIL_MONO: Style = { ...DETAIL, font: 'monoRegular' };
const FACT: Style = { font: 'sansMedium', size: 9.4, color: COLOR.ink };
const FACT_MONO: Style = { ...FACT, font: 'monoMedium' };
const SECTION: Style = { font: 'sansSemiBold', size: 10.5, color: COLOR.ink };
const SMALL: Style = { font: 'sansRegular', size: 7.6, color: COLOR.faint };
const PERIOD: Style = { font: 'sansRegular', size: 9.6, color: COLOR.ink };
const ROW_AMOUNT: Style = { ...PERIOD, font: 'monoRegular', tnum: true };
const FOOTER: Style = { font: 'sansRegular', size: 7.2, color: COLOR.faint };
const FOOTER_MONO: Style = { ...FOOTER, font: 'monoRegular' };

// Du haut de la ligne du montant à sa ligne de base (Plex Sans 30 pt, interligne 1).
const AMOUNT_BASELINE = 26.3;
// Flèche des périodes, posée à mi-hauteur d'x sous le haut de la ligne.
const ARROW = { gap: 3.5, length: 7, head: 2.2, drop: 7.3 };

// Hauteurs fixes, communes à la mesure et au dessin.
const BADGE_H = lineH(BADGE) + 4;
const PARTY_NAME_TOP = PARTY_PAD_TOP + lineH(CAPTION) + 5;
const FACT_VALUE_TOP = FACT_PAD_TOP + lineH(CAPTION) + 4;
const SECTION_H = lineH(SECTION) + 6;
const TABLE_HEAD_H = HEAD_PAD_Y * 2 + lineH(SMALL) + 1;
const FOOTER_TOP = PAGE_H - 20 - lineH(FOOTER);
const CONTENT_BOTTOM = FOOTER_TOP - 14;

const BADGE_TONE = {
  success: { bg: COLOR.successBg, fg: COLOR.successFg },
  neutral: { bg: COLOR.neutralBg, fg: COLOR.neutralFg },
} as const;

// ── Helpers de texte ──

function lineH(s: Style): number {
  return (s.lineHeight ?? LINE_HEIGHT) * s.size;
}

// Applique le style ; l'interligne reproduit un line-height CSS.
function use(
  doc: Doc,
  F: FontSet,
  s: Style,
): TextOptions & { lineGap: number } {
  doc.font(F[s.font]).fontSize(s.size).fillColor(s.color);
  return {
    lineGap: lineH(s) - doc.currentLineHeight(true),
    characterSpacing: s.spacing ?? 0,
    features: s.tnum ? ['tnum'] : undefined,
  };
}

// `top` est le haut de la boîte de ligne, comme en CSS.
function textBox(
  doc: Doc,
  F: FontSet,
  s: Style,
  text: string,
  x: number,
  top: number,
  options: TextOptions = { lineBreak: false },
) {
  const base = use(doc, F, s);
  doc.text(text, x, top + base.lineGap / 2, { ...base, ...options });
}

function heightOf(
  doc: Doc,
  F: FontSet,
  s: Style,
  text: string,
  width: number,
): number {
  return doc.heightOfString(text, { ...use(doc, F, s), width });
}

function widthOf(doc: Doc, F: FontSet, s: Style, text: string): number {
  return doc.widthOfString(text, use(doc, F, s));
}

function caption(
  doc: Doc,
  F: FontSet,
  text: string,
  x: number,
  top: number,
  color: string,
) {
  textBox(doc, F, { ...CAPTION, color }, text.toUpperCase(), x, top);
}

function rule(doc: Doc, x: number, y: number, w: number, color: string) {
  doc.rect(x, y, w, 1).fill(color);
}

// ── Sections ──

function meta(doc: Doc, F: FontSet, label: string, value: string, top: number) {
  textBox(doc, F, META, label, MARGIN_X, top);
  const x = MARGIN_X + widthOf(doc, F, META, label) + 3;
  textBox(doc, F, META_VALUE, value, x, top);
}

function drawHeader(doc: Doc, F: FontSet, c: ReceiptContent): number {
  textBox(doc, F, TITLE, c.title, MARGIN_X, MARGIN_TOP);
  const metaTop = MARGIN_TOP + lineH(TITLE) + 6;
  meta(doc, F, 'N°', c.receiptNo, metaTop);
  meta(doc, F, 'Émis le', c.issuedOn, metaTop + lineH(META) + 2);

  const brandW = widthOf(doc, F, BRAND, 'LanGestLoc');
  const brandX = MARGIN_X + CONTENT_W - brandW;
  const inset = (LOGO_BOX - LOGO) / 2;
  drawLogo(doc, brandX - 6 - LOGO_BOX + inset, MARGIN_TOP + inset, LOGO);
  textBox(
    doc,
    F,
    BRAND,
    'LanGestLoc',
    brandX,
    MARGIN_TOP + (LOGO_BOX - lineH(BRAND)) / 2,
  );

  const ruleY = metaTop + lineH(META) * 2 + 2 + BLOCK_GAP;
  rule(doc, MARGIN_X, ruleY, CONTENT_W, COLOR.brand);
  return ruleY + 1;
}

function drawBadge(
  doc: Doc,
  F: FontSet,
  badge: ReceiptBadge,
  right: number,
  top: number,
) {
  const tone = BADGE_TONE[badge.tone];
  const style = { ...BADGE, color: tone.fg };
  const w = 6 + CHECK + 3 + widthOf(doc, F, style, badge.label) + 7;
  const x = right - w;
  doc.roundedRect(x, top, w, BADGE_H, BADGE_H / 2).fill(tone.bg);

  // Coche tracée dans un carré de 12 unités.
  const k = CHECK / 12;
  const cx = x + 6;
  const cy = top + (BADGE_H - CHECK) / 2;
  doc
    .save()
    .moveTo(cx + 2.5 * k, cy + 6.3 * k)
    .lineTo(cx + 4.7 * k, cy + 8.5 * k)
    .lineTo(cx + 9.5 * k, cy + 3.5 * k)
    .lineWidth(1.8 * k)
    .lineCap('round')
    .lineJoin('round')
    .strokeColor(tone.fg)
    .stroke()
    .restore();
  textBox(doc, F, style, badge.label, cx + CHECK + 3, top + 2);
}

function drawHero(
  doc: Doc,
  F: FontSet,
  c: ReceiptContent,
  top: number,
): number {
  const x = MARGIN_X + HERO_PAD_X;
  const w = CONTENT_W - HERO_PAD_X * 2;
  const lead = 'Arrêté le présent reçu à la somme de ';
  const topRow = top + HERO_PAD_TOP;
  const topH = c.badge ? BADGE_H : lineH(CAPTION);
  const amountTop = topRow + topH + 7;
  const whenTop = amountTop + lineH(AMOUNT) + 6;
  const dividerY = whenTop + lineH(WHEN) + 9;
  const wordsTop = dividerY + 1 + 8;
  // Mesurée tout en medium, la phrase ne peut que tenir dans la hauteur prévue.
  const wordsH = heightOf(doc, F, WORDS_SUM, `${lead}${c.amountInWords}.`, w);
  const bottom = wordsTop + wordsH + HERO_PAD_BOTTOM;

  doc.roundedRect(MARGIN_X, top, CONTENT_W, bottom - top, 12).fill(COLOR.soft);
  caption(
    doc,
    F,
    c.heroCaption,
    x,
    topRow + (topH - lineH(CAPTION)) / 2,
    COLOR.brand,
  );
  if (c.badge) drawBadge(doc, F, c.badge, x + w, topRow);

  const baseline = amountTop + AMOUNT_BASELINE;
  const amount = use(doc, F, AMOUNT);
  const onBaseline = { baseline: 'alphabetic', lineBreak: false } as const;
  doc.text(c.amount, x, baseline, { ...amount, ...onBaseline });
  const currencyX = x + doc.widthOfString(c.amount, amount) + 4;
  doc.text('GNF', currencyX, baseline, {
    ...use(doc, F, CURRENCY),
    ...onBaseline,
  });

  textBox(doc, F, WHEN, c.when, x, whenTop);
  rule(doc, x, dividerY, w, COLOR.divider);

  const words = use(doc, F, WORDS);
  doc.text(lead, x, wordsTop + words.lineGap / 2, {
    ...words,
    width: w,
    continued: true,
  });
  use(doc, F, WORDS_SUM);
  doc.text(c.amountInWords, { continued: true });
  use(doc, F, WORDS);
  doc.text('.');
  return bottom;
}

// Boîtes de contenu d'une rangée de la fiche ; dès la 2e, un filet à gauche.
function cells(widths: number[]) {
  let left = MARGIN_X + 1;
  return widths.map((width, i) => {
    const border = i > 0 ? 1 : 0;
    const cell = {
      left,
      x: left + border + CELL_PAD_X,
      w: width - border - CELL_PAD_X * 2,
    };
    left += width;
    return cell;
  });
}

const factStyle = (fact: ReceiptFact) => (fact.mono ? FACT_MONO : FACT);

// Tiers égaux, sauf si le n° du contrat demande plus pour tenir sur une ligne.
function factWidths(
  doc: Doc,
  F: FontSet,
  [, contract]: ReceiptContent['facts'],
): number[] {
  const inner = CONTENT_W - 2;
  const needed =
    Math.ceil(widthOf(doc, F, factStyle(contract), contract.value)) +
    1 +
    CELL_PAD_X * 2;
  const middle = Math.max(inner / 3, needed);
  const side = (inner - middle) / 2;
  return [side, middle, side];
}

interface Party {
  label: string;
  name: string;
  detail: string;
  detailStyle: Style;
}

// Moitiés égales, sauf si un nom tient sur une ligne quand l'autre colonne se resserre.
function partyWidths(doc: Doc, F: FontSet, parties: Party[]): number[] {
  const inner = CONTENT_W - 2;
  const [a, b] = parties.map(
    (p) =>
      Math.ceil(
        Math.max(
          widthOf(doc, F, NAME, p.name),
          widthOf(doc, F, p.detailStyle, p.detail),
        ),
      ) +
      1 +
      CELL_PAD_X * 2,
  );
  if (Math.max(a, b) <= inner / 2 || a + b > inner) {
    return [inner / 2, inner / 2];
  }
  return a > b ? [a, inner - a] : [inner - b, b];
}

function drawCard(
  doc: Doc,
  F: FontSet,
  c: ReceiptContent,
  top: number,
): number {
  const parties: Party[] = [
    {
      label: 'Bailleur',
      name: c.landlord.name,
      detail: c.landlord.detail,
      detailStyle: DETAIL,
    },
    {
      label: 'Locataire',
      name: c.tenant.name,
      detail: c.tenant.phone,
      detailStyle: DETAIL_MONO,
    },
  ];
  const partyCells = cells(partyWidths(doc, F, parties));
  const blocks = parties.map((p, i) => {
    const { w } = partyCells[i];
    const detailTop = PARTY_NAME_TOP + heightOf(doc, F, NAME, p.name, w) + 2;
    const detailH = heightOf(doc, F, p.detailStyle, p.detail, w);
    return { detailTop, height: detailTop + detailH + PARTY_PAD_BOTTOM };
  });
  const partiesH = Math.max(...blocks.map((b) => b.height));

  const factCells = cells(factWidths(doc, F, c.facts));
  const factsH = Math.max(
    ...c.facts.map(
      (f, i) =>
        FACT_VALUE_TOP +
        heightOf(doc, F, factStyle(f), f.value, factCells[i].w) +
        FACT_PAD_BOTTOM,
    ),
  );

  const factsTop = top + 1 + partiesH;
  const height = partiesH + factsH + 3;
  doc.save();
  doc.roundedRect(MARGIN_X, top, CONTENT_W, height, 10).clip();
  doc
    .rect(MARGIN_X, factsTop, CONTENT_W, top + height - factsTop)
    .fill(COLOR.soft);
  rule(doc, MARGIN_X, factsTop, CONTENT_W, COLOR.line);
  doc.rect(partyCells[1].left, top, 1, partiesH + 1).fill(COLOR.line);
  for (const cell of factCells.slice(1)) {
    doc.rect(cell.left, factsTop, 1, factsH + 2).fill(COLOR.line);
  }
  doc.restore();
  doc
    .roundedRect(MARGIN_X + 0.5, top + 0.5, CONTENT_W - 1, height - 1, 9.5)
    .lineWidth(1)
    .strokeColor(COLOR.line)
    .stroke();

  parties.forEach((p, i) => {
    const { x, w } = partyCells[i];
    const cellTop = top + 1;
    caption(doc, F, p.label, x, cellTop + PARTY_PAD_TOP, COLOR.brand);
    textBox(doc, F, NAME, p.name, x, cellTop + PARTY_NAME_TOP, { width: w });
    textBox(doc, F, p.detailStyle, p.detail, x, cellTop + blocks[i].detailTop, {
      width: w,
    });
  });

  c.facts.forEach((f, i) => {
    const { x, w } = factCells[i];
    const cellTop = factsTop + 1;
    caption(doc, F, f.label, x, cellTop + FACT_PAD_TOP, COLOR.faint);
    textBox(doc, F, factStyle(f), f.value, x, cellTop + FACT_VALUE_TOP, {
      width: w,
    });
  });

  return top + height;
}

function drawTableHead(doc: Doc, F: FontSet, top: number): number {
  textBox(doc, F, SMALL, 'Période', MARGIN_X, top + HEAD_PAD_Y);
  textBox(doc, F, SMALL, 'Montant', MARGIN_X, top + HEAD_PAD_Y, {
    width: CONTENT_W,
    align: 'right',
  });
  rule(doc, MARGIN_X, top + TABLE_HEAD_H - 1, CONTENT_W, COLOR.line);
  return top + TABLE_HEAD_H;
}

const rowHeight = (row: ReceiptRow) =>
  ROW_PAD_Y * 2 +
  lineH(PERIOD) +
  (row.detail ? ROW_DETAIL_GAP + lineH(SMALL) : 0) +
  1;

function drawRow(doc: Doc, F: FontSet, row: ReceiptRow, top: number) {
  const y = top + ROW_PAD_Y;
  textBox(doc, F, PERIOD, row.from, MARGIN_X, y);
  if (row.to) {
    const x0 = MARGIN_X + widthOf(doc, F, PERIOD, row.from) + ARROW.gap;
    const x1 = x0 + ARROW.length;
    const ay = y + ARROW.drop;
    doc
      .save()
      .moveTo(x0, ay)
      .lineTo(x1, ay)
      .moveTo(x1 - ARROW.head, ay - ARROW.head)
      .lineTo(x1, ay)
      .lineTo(x1 - ARROW.head, ay + ARROW.head)
      .lineWidth(0.8)
      .lineCap('round')
      .lineJoin('round')
      .strokeColor(COLOR.ink)
      .stroke()
      .restore();
    textBox(doc, F, PERIOD, row.to, x1 + ARROW.gap, y);
  }
  textBox(doc, F, ROW_AMOUNT, groupDigits(row.total), MARGIN_X, y, {
    width: CONTENT_W,
    align: 'right',
  });
  if (row.detail) {
    const detailTop = y + lineH(PERIOD) + ROW_DETAIL_GAP;
    textBox(doc, F, SMALL, row.detail, MARGIN_X, detailTop);
  }
  rule(doc, MARGIN_X, top + rowHeight(row) - 1, CONTENT_W, COLOR.line);
}

function drawDetail(doc: Doc, F: FontSet, rows: ReceiptRow[], top: number) {
  let sectionTop = top + 16;
  // Le titre et les en-têtes ne restent pas seuls en bas de page.
  const firstRowEnd =
    sectionTop + SECTION_H + TABLE_HEAD_H + rowHeight(rows[0]);
  if (firstRowEnd > CONTENT_BOTTOM) {
    doc.addPage();
    sectionTop = MARGIN_TOP;
  }
  textBox(doc, F, SECTION, 'Détail du paiement', MARGIN_X, sectionTop);
  let y = drawTableHead(doc, F, sectionTop + SECTION_H);
  for (const row of rows) {
    if (y + rowHeight(row) > CONTENT_BOTTOM) {
      doc.addPage();
      y = drawTableHead(doc, F, MARGIN_TOP);
    }
    drawRow(doc, F, row, y);
    y += rowHeight(row);
  }
}

function drawFooters(doc: Doc, F: FontSet, receiptNo: string) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    textBox(
      doc,
      F,
      FOOTER,
      'Ce reçu fait foi du paiement.',
      MARGIN_X,
      FOOTER_TOP,
    );
    textBox(doc, F, FOOTER_MONO, receiptNo, MARGIN_X, FOOTER_TOP, {
      width: CONTENT_W,
      align: 'right',
    });
    if (range.count > 1) {
      textBox(
        doc,
        F,
        FOOTER,
        `Page ${i + 1} / ${range.count}`,
        MARGIN_X,
        FOOTER_TOP,
        { width: CONTENT_W, align: 'center' },
      );
    }
  }
}

// ── Point d'entrée ──

export function buildReceiptPdf(
  payment: ReceiptPayment,
  receiptNo: string,
  bailleur: string,
  lieu: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Marge basse nulle : la pagination se fait à la main, au-dessus du pied.
    const doc = new PDFDocument({
      size: 'A4',
      autoFirstPage: false,
      margins: { top: MARGIN_TOP, bottom: 0, left: MARGIN_X, right: MARGIN_X },
      bufferPages: true,
    });
    doc.on('pageAdded', () => doc.scale(SCALE));
    doc.addPage();
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const F = registerFonts(doc);
    const c = receiptContent({
      payment,
      receiptNo,
      bailleur,
      lieu,
      issuedAt: new Date(),
    });

    let y = drawHeader(doc, F, c);
    y = drawHero(doc, F, c, y + BLOCK_GAP);
    y = drawCard(doc, F, c, y + BLOCK_GAP);
    if (c.rows) drawDetail(doc, F, c.rows, y);
    drawFooters(doc, F, c.receiptNo);

    doc.end();
  });
}
