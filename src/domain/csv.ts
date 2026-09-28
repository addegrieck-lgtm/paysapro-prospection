// Lecture / écriture CSV sans dépendance.
// Lecture : UTF-8 (avec ou sans BOM), séparateur « , » « ; » ou tabulation détecté automatiquement,
// guillemets et retours à la ligne dans les cellules gérés.
// Écriture : séparateur « ; » + BOM UTF-8 → s'ouvre directement et correctement dans Excel (France).

export type Delimiter = ',' | ';' | '\t';

export function detectDelimiter(text: string): Delimiter {
  const firstLine = text.slice(0, 5000).split(/\r?\n/)[0] ?? '';
  const count = (ch: string) => {
    let n = 0;
    let quoted = false;
    for (const c of firstLine) {
      if (c === '"') quoted = !quoted;
      else if (c === ch && !quoted) n++;
    }
    return n;
  };
  const candidates: Delimiter[] = [';', ',', '\t'];
  return candidates.reduce((best, d) => (count(d) > count(best) ? d : best), ',' as Delimiter);
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: Delimiter;
}

export function parseCsv(input: string, delimiter?: Delimiter): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const d = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === d) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  const [headerRow = [], ...body] = nonEmpty;
  return { headers: headerRow.map((h) => h.trim()), rows: body, delimiter: d };
}

function escapeCell(v: unknown, d: string): string {
  if (v === null || v === undefined) return '';
  let s = Array.isArray(v) ? v.join(', ') : String(v);
  // Protection contre l'injection de formules dans Excel
  if (/^[=+\-@]/.test(s) && !/^-?\d/.test(s)) s = `'${s}`;
  return /["\r\n]/.test(s) || s.includes(d) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][], delimiter: Delimiter = ';'): string {
  const lines = [headers, ...rows].map((r) => r.map((v) => escapeCell(v, delimiter)).join(delimiter));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
