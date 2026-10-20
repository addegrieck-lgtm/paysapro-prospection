/** Utilitaires texte : échappement, slug, Markdown sûr, CSV. */

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(u)) return u;
  return null;
}

/** Mise en forme en ligne : **gras**, *italique*, `code`, [lien](url). Le texte est échappé AVANT transformation. */
function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
    // href a déjà été échappé (&amp;…) : on le décode seulement pour valider le schéma.
    const raw = href.replace(/&amp;/g, '&');
    const ok = safeHref(raw);
    if (!ok) return text;
    const ext = /^https?:/i.test(ok);
    return `<a href="${escapeHtml(ok)}"${ext ? ' rel="noopener" target="_blank"' : ''}>${text}</a>`;
  });
  return out;
}

/**
 * Markdown minimal et SÛR (aucun HTML brut accepté) : titres ##/###, paragraphes, listes - et 1., citations >,
 * séparateur ---, gras, italique, code, liens http(s)/mailto/tel/relatifs.
 */
export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let para: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if ((m = line.match(/^(#{2,4})\s+(.+)$/))) {
      flushPara();
      flushList();
      const level = m[1]!.length;
      html.push(`<h${level} id="${slugify(m[2]!)}">${inline(m[2]!)}</h${level}>`);
    } else if (/^---+$/.test(line.trim())) {
      flushPara();
      flushList();
      html.push('<hr>');
    } else if ((m = line.match(/^\s*[-*]\s+(.+)$/))) {
      flushPara();
      if (list?.type !== 'ul') flushList();
      list ??= { type: 'ul', items: [] };
      list.items.push(m[1]!);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.+)$/))) {
      flushPara();
      if (list?.type !== 'ol') flushList();
      list ??= { type: 'ol', items: [] };
      list.items.push(m[1]!);
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara();
      flushList();
      html.push(`<blockquote><p>${inline(m[1]!)}</p></blockquote>`);
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return html.join('\n');
}

/** Texte brut d'un Markdown (extraits, description). */
export function plainText(md: string, max = 0): string {
  const t = md.replace(/[#>*`_-]+/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
  return max && t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}

export function wordCount(s: string): number {
  return plainText(s).split(' ').filter(Boolean).length;
}

/**
 * Cellule CSV sûre : guillemets doublés, et neutralisation des formules (=, +, -, @, tabulation)
 * pour empêcher l'injection de formules à l'ouverture dans un tableur.
 */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV au format français (séparateur ; et BOM UTF-8 pour Excel). */
export function toCsv(headers: string[], rows: unknown[][]): string {
  return '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

export function lines(s: string): string[] {
  return s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}
