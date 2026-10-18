import { COLOR } from './colors';

// Icône `frontend/app/icon.svg` : carré de 88 unités dont l'angle haut-gauche est en (6, 6).
const ICON_UNITS = 88;
const ICON_ORIGIN = 6;

export function drawLogo(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  size: number,
): void {
  const k = size / ICON_UNITS;
  const rect = (
    ux: number,
    uy: number,
    w: number,
    h: number,
    r: number,
    fill: string | PDFKit.PDFGradient,
  ) =>
    doc
      .roundedRect(
        x + (ux - ICON_ORIGIN) * k,
        y + (uy - ICON_ORIGIN) * k,
        w * k,
        h * k,
        r * k,
      )
      .fill(fill);

  doc.save();
  const gradient = doc
    .linearGradient(x, y, x + size, y + size)
    .stop(0, COLOR.logoFrom)
    .stop(1, COLOR.logoTo);
  rect(ICON_ORIGIN, ICON_ORIGIN, ICON_UNITS, ICON_UNITS, 24, gradient);
  rect(36, 28, 13, 44, 6, COLOR.white);
  rect(36, 59, 34, 13, 6, COLOR.white);
  rect(55, 28, 15, 15, 5, COLOR.logoTint);
  doc.restore();
}
