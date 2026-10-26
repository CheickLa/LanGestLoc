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
  sansRegular: 'IBMPlexSans-Regular.ttf',
  sansMedium: 'IBMPlexSans-Medium.ttf',
  sansSemiBold: 'IBMPlexSans-SemiBold.ttf',
  monoRegular: 'IBMPlexMono-Regular.ttf',
  monoMedium: 'IBMPlexMono-Medium.ttf',
} as const;

// Polices standard pdfkit (toujours disponibles) — repli si Plex absent.
const FALLBACK: FontSet = {
  sansRegular: 'Helvetica',
  sansMedium: 'Helvetica-Bold',
  sansSemiBold: 'Helvetica-Bold',
  monoRegular: 'Courier',
  monoMedium: 'Courier-Bold',
};

/**
 * Enregistre IBM Plex Sans/Mono dans le document si les fichiers de police sont
 * présents dans `assets/fonts/`, sinon retourne les polices standard pdfkit
 */
export function registerFonts(doc: PDFKit.PDFDocument): FontSet {
  const present = Object.values(FILES).every((f) =>
    fs.existsSync(path.join(FONT_DIR, f)),
  );
  if (!present) return FALLBACK;

  const names: FontSet = {
    sansRegular: 'PlexSans',
    sansMedium: 'PlexSansMedium',
    sansSemiBold: 'PlexSansSemiBold',
    monoRegular: 'PlexMono',
    monoMedium: 'PlexMonoMedium',
  };
  doc.registerFont(names.sansRegular, path.join(FONT_DIR, FILES.sansRegular));
  doc.registerFont(names.sansMedium, path.join(FONT_DIR, FILES.sansMedium));
  doc.registerFont(names.sansSemiBold, path.join(FONT_DIR, FILES.sansSemiBold));
  doc.registerFont(names.monoRegular, path.join(FONT_DIR, FILES.monoRegular));
  doc.registerFont(names.monoMedium, path.join(FONT_DIR, FILES.monoMedium));
  return names;
}
