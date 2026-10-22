// Exporte les sous-titres de la voix off (src/config/voix-off.json) en SRT, pour YouTube, Facebook ou LinkedIn.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const cues = JSON.parse(readFileSync(new URL('../src/config/voix-off.json', import.meta.url)));
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const srt = cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(Math.min(c.end + 0.3, (cues[i + 1]?.start ?? Infinity) - 0.05))}\n${c.text}\n`).join('\n');
mkdirSync(new URL('../out/', import.meta.url), { recursive: true });
writeFileSync(new URL('../out/sous-titres-50s.srt', import.meta.url), srt);
console.log('out/sous-titres-50s.srt');
