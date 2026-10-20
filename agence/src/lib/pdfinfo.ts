/**
 * Lecture INDICATIVE d'un PDF (sans dépendance) : nombre de pages, dimensions (MediaBox / TrimBox / BleedBox),
 * présence de polices incorporées. Ne remplace pas la checklist de prépresse : si une information n'est pas
 * lisible (objets compressés), elle est signalée comme « non déterminée ».
 */
export interface PdfInfo {
  pages: number | null;
  mediaBoxMm: [number, number] | null;
  trimBoxMm: [number, number] | null;
  bleedBoxMm: [number, number] | null;
  fonts: number | null;
  embeddedFonts: number | null;
  version: string | null;
}

const PT_TO_MM = 25.4 / 72;

function box(src: string, name: string): [number, number] | null {
  const m = src.match(new RegExp(`/${name}\\s*\\[\\s*(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s*\\]`));
  if (!m) return null;
  const [x1, y1, x2, y2] = m.slice(1, 5).map(Number) as [number, number, number, number];
  return [Math.round(Math.abs(x2 - x1) * PT_TO_MM * 10) / 10, Math.round(Math.abs(y2 - y1) * PT_TO_MM * 10) / 10];
}

export function readPdfInfo(bytes: Uint8Array): PdfInfo {
  let src = '';
  const max = Math.min(bytes.length, 8 * 1024 * 1024);
  for (let i = 0; i < max; i += 65536) src += String.fromCharCode(...bytes.subarray(i, Math.min(i + 65536, max)));
  const version = src.match(/^%PDF-(\d\.\d)/)?.[1] ?? null;
  const pages = (src.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length;
  const fontDescriptors = (src.match(/\/Type\s*\/FontDescriptor\b/g) ?? []).length;
  const embedded = (src.match(/\/FontFile[23]?\b/g) ?? []).length;
  return {
    version,
    pages: pages || null,
    mediaBoxMm: box(src, 'MediaBox'),
    trimBoxMm: box(src, 'TrimBox'),
    bleedBoxMm: box(src, 'BleedBox'),
    fonts: fontDescriptors || null,
    embeddedFonts: fontDescriptors ? embedded : null,
  };
}
