import * as fs from 'fs';
import * as path from 'path';

export interface FontSet {
  sansRegular: string;
  sansMedium: string;
  sansSemiBold: string;
  monoRegular: string;
  monoMedium: string;
}

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');

const FILES = {
  sansRegular: 'Geist-Regular.ttf',
  sansMedium: 'Geist-Medium.ttf',
  sansSemiBold: 'Geist-SemiBold.ttf',
  monoRegular: 'GeistMono-Regular.ttf',
  monoMedium: 'GeistMono-Medium.ttf',
} as const;

// Polices standard pdfkit (toujours disponibles) — repli si Geist absent.
const FALLBACK: FontSet = {
  sansRegular: 'Helvetica',
  sansMedium: 'Helvetica-Bold',
  sansSemiBold: 'Helvetica-Bold',
  monoRegular: 'Courier',
  monoMedium: 'Courier-Bold',
};

/**
 * Enregistre Geist Sans/Mono dans le document si les fichiers de police sont
 * présents dans `assets/fonts/`, sinon retourne les polices standard pdfkit
 */
export function registerFonts(doc: PDFKit.PDFDocument): FontSet {
  const present = Object.values(FILES).every((f) =>
    fs.existsSync(path.join(FONT_DIR, f)),
  );
  if (!present) return FALLBACK;

  const names: FontSet = {
    sansRegular: 'GeistSans',
    sansMedium: 'GeistSansMedium',
    sansSemiBold: 'GeistSansSemiBold',
    monoRegular: 'GeistMono',
    monoMedium: 'GeistMonoMedium',
  };
  doc.registerFont(names.sansRegular, path.join(FONT_DIR, FILES.sansRegular));
  doc.registerFont(names.sansMedium, path.join(FONT_DIR, FILES.sansMedium));
  doc.registerFont(names.sansSemiBold, path.join(FONT_DIR, FILES.sansSemiBold));
  doc.registerFont(names.monoRegular, path.join(FONT_DIR, FILES.monoRegular));
  doc.registerFont(names.monoMedium, path.join(FONT_DIR, FILES.monoMedium));
  return names;
}
