import { describe, expect, it } from 'vitest';
import { computeTotals, formatEuros, parseEuros, ttcOf, vatOf } from '../src/domain/money';
import { computeMargin, labourCost } from '../src/domain/margin';
import {
  costChangedSinceValidation,
  effectiveStatus,
  findExactVariant,
  isPublishable,
  publicEstimate,
  suggestedSalePrice,
  unpricedReason,
  validateConfig,
  type PrintConfig,
  type PrintOptions,
  type VariantRow,
} from '../src/domain/print';
import { csvCell, renderMarkdown, slugify, toCsv, wordCount } from '../src/domain/text';
import { orderTransitionError } from '../src/domain/statuses';
import { DEFAULT_SETTINGS, initials, mergeSettings, missingLegalInfo } from '../src/domain/settings';
import { readPdfInfo } from '../src/lib/pdfinfo';
import { sniffType, safeFileName } from '../src/lib/storage';
import { hashPassword, passwordProblem, verifyPassword } from '../src/lib/crypto';
import { addDays } from '../src/domain/dates';

describe('montants et TVA', () => {
  it('lit les montants saisis à la française', () => {
    expect(parseEuros('1 190,50')).toBe(119050);
    expect(parseEuros('69')).toBe(6900);
    expect(parseEuros('69,9')).toBe(6990);
    expect(parseEuros('1.5')).toBe(150);
    expect(parseEuros('abc')).toBeNull();
    expect(parseEuros('')).toBeNull();
    expect(parseEuros('1,234')).toBeNull();
  });
  it('formate en euros', () => {
    expect(formatEuros(119000, true)).toBe('1 190 €');
    expect(formatEuros(6990)).toBe('69,90 €');
  });
  it('calcule la TVA et le TTC au centime', () => {
    expect(vatOf(6900, 20)).toBe(1380);
    expect(ttcOf(6900, 20)).toBe(8280);
    expect(ttcOf(69000, 20)).toBe(82800);
    expect(vatOf(1000, 5.5)).toBe(55);
  });
  it('totalise par taux de TVA et gère la franchise', () => {
    const lines = [
      { quantity: 1, unit_price_ht: 6900, vat_rate: 20 },
      { quantity: 2, unit_price_ht: 1000, vat_rate: 20 },
      { quantity: 1, unit_price_ht: 1000, vat_rate: 5.5 },
    ];
    const t = computeTotals(lines, 'normal');
    expect(t.ht).toBe(9900);
    expect(t.byRate).toEqual([
      { rate: 5.5, base: 1000, vat: 55 },
      { rate: 20, base: 8900, vat: 1780 },
    ]);
    expect(t.ttc).toBe(9900 + 1835);
    const f = computeTotals(lines, 'franchise');
    expect(f.vat).toBe(0);
    expect(f.ttc).toBe(9900);
  });
});

describe('marges', () => {
  it('distingue taux de marge et taux de marque', () => {
    const m = computeMargin(10000, 6000);
    expect(m.grossMargin).toBe(4000);
    expect(m.marginRate).toBe(66.7); // 4000 / 6000
    expect(m.markRate).toBe(40); // 4000 / 10000
  });
  it('ne divise jamais par zéro', () => {
    expect(computeMargin(10000, 0).marginRate).toBeNull();
    expect(computeMargin(0, 500).markRate).toBeNull();
  });
  it('additionne les coûts directs, temps valorisé compris', () => {
    const m = computeMargin(20000, { production: 1000, supplier: 3000, shipping: 500, external: 500, labour: labourCost(2, 3000) });
    expect(m.directCosts).toBe(11000);
    expect(m.grossMargin).toBe(9000);
  });
});

const options: PrintOptions = {
  format: ['A5', 'A4'],
  orientation: ['Portrait', 'Paysage'],
  paper: ['Couché brillant'],
  weight: ['135 g', '170 g'],
  printing: ['Recto', 'Recto-verso'],
  delivery: ['Standard'],
  quantity: [250, 500, 1000],
  nonPricing: ['orientation'],
};

function variant(over: Partial<VariantRow>): VariantRow {
  return {
    id: 1,
    product_id: 1,
    format: 'A5',
    orientation: '',
    paper: 'Couché brillant',
    weight: '135 g',
    finish: '',
    printing: 'Recto-verso',
    extra: '',
    delivery: 'Standard',
    quantity: 500,
    supplier_price_ht: 3299,
    supplier_shipping_ht: 0,
    supplier_other_fees_ht: 0,
    status: 'verifie',
    verified_at: '2026-10-19T12:00:00.000Z',
    sale_print_ht: 5900,
    sale_shipping_ht: 900,
    sale_other_ht: null,
    sale_validated_at: '2026-10-19T13:00:00.000Z',
    cost_at_validation: 3299,
    lead_time_days: 5,
    ...over,
  };
}

const now = new Date('2026-10-20T10:00:00Z');
const cfg = (over: Partial<PrintConfig> = {}): PrintConfig => ({ format: 'A5', orientation: 'Paysage', paper: 'Couché brillant', weight: '135 g', finish: '', printing: 'Recto-verso', extra: '', delivery: 'Standard', quantity: 500, ...over });

describe('calculateur d’impression', () => {
  it('refuse une option qui n’existe pas chez le fournisseur', () => {
    const r = validateConfig(options, { format: 'A3', orientation: 'Portrait', paper: 'Couché brillant', weight: '135 g', printing: 'Recto', delivery: 'Standard', quantity: 500 });
    expect(r.ok).toBe(false);
    const q = validateConfig(options, { format: 'A5', orientation: 'Portrait', paper: 'Couché brillant', weight: '135 g', printing: 'Recto', delivery: 'Standard', quantity: 750 });
    expect(q.ok).toBe(false);
  });
  it('trouve la variante exacte (orientation sans effet sur le prix)', () => {
    expect(findExactVariant([variant({})], cfg(), options)?.id).toBe(1);
    expect(findExactVariant([variant({})], cfg({ orientation: 'Portrait' }), options)?.id).toBe(1);
  });
  it('n’extrapole jamais entre deux quantités ou finitions', () => {
    const vs = [variant({ id: 1, quantity: 250 }), variant({ id: 2, quantity: 1000 })];
    expect(findExactVariant(vs, cfg({ quantity: 500 }), options)).toBeUndefined();
    const e = publicEstimate({ variants: vs, config: cfg({ quantity: 500 }), options, wantDesign: false, design: null, vatRate: 20, vatMode: 'normal', validityDays: 30, now });
    expect(e.status).toBe('on_request');
    expect(e.totalHt).toBeNull();
    expect(e.printHt).toBeNull();
    expect(e.alternatives.map((a) => a.config.quantity)).toEqual([250, 1000]);
  });
  it('sépare création, impression, livraison, HT, TVA et TTC', () => {
    const e = publicEstimate({ variants: [variant({})], config: cfg(), options, wantDesign: true, design: { name: 'Flyer', priceHt: 6900, priceMode: 'fixed' }, vatRate: 20, vatMode: 'normal', validityDays: 30, now });
    expect(e.status).toBe('priced');
    expect(e.design?.priceHt).toBe(6900);
    expect(e.printHt).toBe(5900);
    expect(e.shippingHt).toBe(900);
    expect(e.totalHt).toBe(13700);
    expect(e.vat).toBe(2740);
    expect(e.totalTtc).toBe(16440);
  });
  it('n’expose aucun coût fournisseur dans l’estimation publique', () => {
    const e = publicEstimate({ variants: [variant({ supplier_price_ht: 1234567 })], config: cfg(), options, wantDesign: false, design: null, vatRate: 20, vatMode: 'normal', validityDays: 30, now });
    expect(JSON.stringify(e)).not.toContain('1234567');
    expect(JSON.stringify(e)).not.toMatch(/supplier|cost/i);
  });
  it('affiche « sur devis » pour un prix non vérifié, expiré ou sans prix de vente validé', () => {
    const run = (v: VariantRow) => publicEstimate({ variants: [v], config: cfg(), options, wantDesign: false, design: null, vatRate: 20, vatMode: 'normal', validityDays: 30, now });
    for (const v of [variant({ status: 'a_verifier' }), variant({ verified_at: '2026-08-01T00:00:00Z' }), variant({ sale_validated_at: null }), variant({ supplier_price_ht: 3500 })]) {
      const e = run(v);
      expect(e.status).toBe('on_request');
      expect(e.reason).toBe('pending');
      expect(e.totalHt).toBeNull();
    }
    expect(unpricedReason(variant({ status: 'a_verifier' }), now, 30)).toBe('unverified');
    expect(unpricedReason(variant({ verified_at: '2026-08-01T00:00:00Z' }), now, 30)).toBe('expired');
    expect(unpricedReason(variant({ sale_validated_at: null }), now, 30)).toBe('no_sale_price');
    expect(unpricedReason(variant({ supplier_price_ht: 3500 }), now, 30)).toBe('cost_changed');
    expect(unpricedReason(variant({}), now, 30)).toBeNull();
  });
  it('détecte l’expiration selon la durée paramétrée', () => {
    expect(effectiveStatus({ status: 'verifie', verified_at: '2026-09-25T00:00:00Z' }, now, 30)).toBe('verifie');
    expect(effectiveStatus({ status: 'verifie', verified_at: '2026-09-15T00:00:00Z' }, now, 30)).toBe('expire');
    expect(effectiveStatus({ status: 'verifie', verified_at: null }, now, 30)).toBe('a_verifier');
  });
  it('signale un coût changé sans modifier le prix public', () => {
    const v = variant({ supplier_price_ht: 3600 });
    expect(costChangedSinceValidation(v)).toBe(true);
    expect(isPublishable(v, now, 30)).toBe(false);
    expect(v.sale_print_ht).toBe(5900);
  });
  it('création « sur devis » : impression chiffrée mais total non affiché', () => {
    const e = publicEstimate({ variants: [variant({})], config: cfg(), options, wantDesign: true, design: { name: 'Dépliant', priceHt: null, priceMode: 'quote' }, vatRate: 20, vatMode: 'normal', validityDays: 30, now });
    expect(e.status).toBe('on_request');
    expect(e.printHt).toBe(5900);
    expect(e.totalHt).toBeNull();
  });
  it('applique la franchise de TVA', () => {
    const e = publicEstimate({ variants: [variant({})], config: cfg(), options, wantDesign: false, design: null, vatRate: 20, vatMode: 'franchise', validityDays: 30, now });
    expect(e.vat).toBe(0);
    expect(e.totalTtc).toBe(e.totalHt);
  });
  it('propose un prix suggéré sans l’appliquer', () => {
    expect(suggestedSalePrice(3299, 35)).toBe(4500);
  });
});

describe('statuts des commandes', () => {
  const base = { bat_required: true, hasAcceptedProof: false, hasSentProof: false, supplierOrderRef: '', supplierOrderedAt: null };
  it('interdit les étapes fournisseur sans BAT accepté', () => {
    expect(orderTransitionError('commande_a_passer', base)).toMatch(/BAT/);
    expect(orderTransitionError('en_production', base)).toMatch(/BAT/);
    expect(orderTransitionError('bat_accepte', base)).toMatch(/BAT/);
  });
  it('interdit « commande passée » sans référence fournisseur réelle', () => {
    expect(orderTransitionError('commande_passee', { ...base, hasAcceptedProof: true })).toMatch(/référence/);
    expect(orderTransitionError('commande_passee', { ...base, hasAcceptedProof: true, supplierOrderRef: 'HP-123', supplierOrderedAt: '2026-10-20' })).toBeNull();
  });
  it('autorise l’annulation et les étapes amont', () => {
    expect(orderTransitionError('annule', base)).toBeNull();
    expect(orderTransitionError('devis_envoye', base)).toBeNull();
    expect(orderTransitionError('bat_envoye', base)).toMatch(/BAT/);
  });
});

describe('textes', () => {
  it('Markdown : aucun HTML ni lien dangereux', () => {
    const html = renderMarkdown('## Titre\n<script>alert(1)</script>\n[x](javascript:alert(1)) [ok](https://exemple.fr) **gras** "q"');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="https://exemple.fr"');
    expect(html).toContain('<strong>gras</strong>');
    expect(html).toContain('<h2 id="titre">');
  });
  it('CSV : neutralise les formules et échappe les séparateurs', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+33 6')).toBe("'+33 6");
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(toCsv(['A'], [['x']]).startsWith('﻿A')).toBe(true);
  });
  it('slugs et comptage', () => {
    expect(slugify('Création de Site — Été 2026 !')).toBe('creation-de-site-ete-2026');
    expect(wordCount('## Un titre\nDeux mots')).toBe(4);
    expect(initials('Atelier Sillage')).toBe('AS');
  });
  it('dates', () => {
    expect(addDays('2026-10-20', 30)).toBe('2026-11-19');
  });
});

describe('paramètres', () => {
  it('ne contient aucune information légale inventée par défaut', () => {
    expect(DEFAULT_SETTINGS.legal.siren).toBe('');
    expect(DEFAULT_SETTINGS.legal.address).toBe('');
    expect(missingLegalInfo(DEFAULT_SETTINGS).length).toBeGreaterThan(3);
  });
  it('fusionne les paramètres partiels', () => {
    const s = mergeSettings({ agencyName: 'Nouveau Nom', legal: { siren: '123456789' } });
    expect(s.agencyName).toBe('Nouveau Nom');
    expect(s.legal.siren).toBe('123456789');
    expect(s.vatRate).toBe(20);
  });
});

describe('fichiers', () => {
  it('détermine le type réel par la signature', () => {
    expect(sniffType(new TextEncoder().encode('%PDF-1.7\n'))).toBe('application/pdf');
    expect(sniffType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
    expect(sniffType(new TextEncoder().encode('MZ executable'))).toBeNull();
  });
  it('nettoie les noms de fichiers', () => {
    expect(safeFileName('../../etc/passwd', 'application/pdf')).toBe('passwd.pdf');
    expect(safeFileName('Mon logo <final>.png', 'image/png')).toBe('Mon logo _final_.png');
  });
  it('lit les dimensions d’un PDF simple', () => {
    const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj << /Type /Page /MediaBox [0 0 425.2 595.3] /TrimBox [8.5 8.5 416.7 586.8] >> endobj\n');
    const info = readPdfInfo(pdf);
    expect(info.pages).toBe(1);
    expect(info.mediaBoxMm).toEqual([150, 210]);
    expect(info.trimBoxMm).toEqual([144, 204]);
  });
});

describe('mots de passe', () => {
  it('hache et vérifie (PBKDF2)', async () => {
    const h = await hashPassword('motdepasse-solide-2026');
    expect(h.startsWith('pbkdf2$100000$')).toBe(true);
    expect(await verifyPassword('motdepasse-solide-2026', h)).toBe(true);
    expect(await verifyPassword('mauvais', h)).toBe(false);
  });
  it('impose une longueur minimale', () => {
    expect(passwordProblem('court1')).not.toBeNull();
    expect(passwordProblem('uniquementdeslettres')).not.toBeNull();
    expect(passwordProblem('assez-long-2026')).toBeNull();
  });
});
