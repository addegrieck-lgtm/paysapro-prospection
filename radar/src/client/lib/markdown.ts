/**
 * Rendu Markdown minimal et SÛR pour les réponses de RADAR AI : tout le texte est échappé avant transformation,
 * seuls titres, gras, italique, listes, tableaux, séparateurs et liens http(s) sont produits.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s: string): string {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-volt-300 underline">$1</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="text-volt-300 underline">$2</a>');
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    if (/^#{1,4}\s/.test(line)) {
      out.push(`<h3>${inline(line.replace(/^#+\s/, ''))}</h3>`);
      i++;
    } else if (/^---+\s*$/.test(line)) {
      out.push('<hr/>');
      i++;
    } else if (/^\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i]!)) {
        const cells = lines[i]!.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(`<div class="overflow-x-auto"><table><thead><tr>${(head ?? []).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i]!)) {
        items.push(`<li>${inline(lines[i]!.replace(/^\s*([-*]|\d+\.)\s/, ''))}</li>`);
        i++;
      }
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
    } else {
      const para: string[] = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]!) && !/^(#{1,4}\s|\||\s*([-*]|\d+\.)\s|---)/.test(lines[i]!)) {
        para.push(inline(lines[i]!));
        i++;
      }
      out.push(`<p>${para.join('<br/>')}</p>`);
    }
  }
  return out.join('');
}
