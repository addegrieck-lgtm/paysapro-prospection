// Lien S&S Social Finder → Prospection : le fichier « Envoyer vers Prospection » doit être reconnu sans réglage.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { autoDetectMapping, mapRow } from '../src/domain/mapping';
import { parseCsv } from '../src/domain/csv';

const spec = JSON.parse(readFileSync(new URL('../social-finder/prospection-import.json', import.meta.url), 'utf8')) as {
  mapped: Record<string, string>;
  informative: string[];
};
const headers = [...Object.keys(spec.mapped), ...spec.informative];

describe('import du fichier S&S Social Finder', () => {
  it('reconnaît automatiquement chaque colonne et ignore les colonnes « SF »', () => {
    const mapping = autoDetectMapping(headers);
    headers.forEach((h, i) => expect([h, mapping[i]]).toEqual([h, spec.mapped[h] ?? null]));
  });

  it('crée un prospect avec ses liens sociaux', () => {
    const csv = '﻿' + headers.join(';') + '\n' +
      'Le Petit Quai;Le Havre;76;Restaurant;https://www.lepetitquai.fr;https://www.facebook.com/lepetitquai/;https://www.instagram.com/lepetitquai/;https://www.instagram.com/lepetitquai/;92;71;83.6;Site à moderniser;Nouveau;2026-10-31\n';
    const parsed = parseCsv(csv);
    const { input, errors } = mapRow(parsed.rows[0] ?? [], autoDetectMapping(parsed.headers));
    expect(errors).toEqual([]);
    expect(input).toMatchObject({ name: 'Le Petit Quai', city: 'Le Havre', department: '76', activity: 'Restaurant' });
    expect(input?.instagram).toContain('instagram.com/lepetitquai');
    expect(input?.facebook).toContain('facebook.com/lepetitquai');
  });
});
