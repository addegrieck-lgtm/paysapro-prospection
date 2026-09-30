import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openProspectingDB } from '../src/data/db';
import { ProspectsApi, defaultSettings, type RepoContext } from '../src/data/repository';
import {
  buildEmail,
  defaultSalesConfig,
  dynamicAnswer,
  emailHtml,
  emailLinks,
  emailText,
  entryAnswer,
  introScript,
  personalizationFor,
  readiness,
  riskyWording,
  safeUrl,
  salesConfig,
  salesFunnel,
  salesVars,
  say,
  searchKb,
  smsUrl,
  treeChildren,
  whatsappUrl,
  type SalesConfig,
} from '../src/domain/sales';
import { ExternalSalesAIProvider, KnowledgeBaseProvider, checkRewrite, officialFacts } from '../src/providers/salesAssistant';
import { can } from '../src/domain/access';

let n = 0;
async function setup(ctx: Partial<RepoContext> = {}) {
  const db = await openProspectingDB(`sales-${++n}-${Date.now()}`);
  return new ProspectsApi(db, { workspaceId: 'w1', user: 'Adrien', role: 'owner', ...ctx });
}

const settings = { ...defaultSettings('w1'), signature: 'Adrien\nPaysapro' };
const cfg = defaultSalesConfig();
/** Configuration sans aucune formule (tarifs non configurés) */
const bare: SalesConfig = { ...cfg, offers: [] };
const withLinks: SalesConfig = { ...cfg, links: { ...cfg.links, demo: 'https://exemple.test/demo', video: 'exemple.test/video' }, image: { dataUrl: null, url: 'https://exemple.test/capture.png', clickable: true } };

describe('Contenu commercial : aucune invention', () => {
  it('ne contient ni prix, ni lien, ni promesse irréaliste par défaut', () => {
    const all = JSON.stringify(cfg);
    // Seule formule pré-remplie : la bêta gratuite annoncée par le produit lui-même
    expect(cfg.offers.map((o) => [o.name, o.price])).toEqual([['Bêta', '0 €']]);
    expect(Object.values(cfg.links).every((l) => l === '')).toBe(true);
    expect(all).not.toMatch(/https?:\/\//);
    expect(all.replace('"0 €"', '')).not.toMatch(/\d+\s?€/);
    expect(cfg.productName).toBe('Paysapro AI');
    // Le produit vendu est l'application de devis, pas l'outil de prospection
    expect(cfg.presentation).toMatch(/devis/);
    expect(all).not.toMatch(/SIRENE|enrichissement|trouver des prospects/i);
    // « garanti » / « 100 % » n'apparaissent que dans les consignes « À éviter »
    const spoken = [cfg.presentation, cfg.pitch30, cfg.pitch60, ...cfg.entries.flatMap((e) => [e.short, e.long]), ...cfg.objections.flatMap((o) => [o.short, o.long, o.followUp]), ...cfg.arguments.map((a) => a.text), ...cfg.emails.map((e) => e.body)].join(' ');
    expect(riskyWording(spoken)).toEqual([]);
  });

  it('couvre 16 objections, au moins 15 questions fréquentes, 6 modèles et 7 besoins', () => {
    expect(cfg.objections).toHaveLength(16);
    expect(cfg.entries.filter((e) => e.faq).length).toBeGreaterThanOrEqual(15);
    expect(cfg.emails).toHaveLength(6);
    expect(cfg.arguments).toHaveLength(7);
    expect(cfg.comparison).toHaveLength(4);
    for (const o of cfg.objections) if (!o.dynamic) expect(o.short && o.long && o.followUp).toBeTruthy();
  });

  it('la configuration enregistrée complète le contenu par défaut', () => {
    const c = salesConfig({ sales: { ...cfg, productName: 'Mon outil', links: { ...cfg.links, demo: 'https://a.test' } } });
    expect(c.productName).toBe('Mon outil');
    expect(c.links.demo).toBe('https://a.test');
    expect(c.script.intro).toBe(cfg.script.intro);
    expect(salesConfig({}).productName).toBe('Paysapro AI');
  });
});

describe('Personnalisation', () => {
  const p = { contactFirstName: 'Julie', name: 'JARDINS DU NORD', tradeName: 'Jardins du Nord', city: 'Lille', department: '59', services: [], activity: "Services d'aménagement paysager", headcount: null, headcountBand: '12' } as never;

  it('utilise le prénom, l’entreprise, la ville et l’activité de la fiche', () => {
    const per = personalizationFor(p, settings, cfg);
    expect(per).toMatchObject({ firstName: 'Julie', company: 'Jardins du Nord', city: 'Lille', department: 'Nord', kind: 'structure' });
    const mail = buildEmail(cfg.emails[1]!, salesVars(per, cfg));
    expect(mail.body).toMatch(/^Bonjour Julie,/);
    expect(mail.body).toContain('comme Jardins du Nord');
    expect(mail.body.endsWith('Adrien\nPaysapro')).toBe(true);
    expect(buildEmail(cfg.emails[2]!, salesVars(per, cfg)).body).toContain('un sujet pour Jardins du Nord');
  });

  it('prénom inconnu : formule générique, jamais de prénom inventé ; variable inconnue : ligne supprimée', () => {
    const per = personalizationFor(null, { ...settings, signature: '' }, cfg);
    const vars = salesVars(per, cfg);
    const mail = buildEmail(cfg.emails[0]!, vars);
    expect(mail.body).toMatch(/^Bonjour,\n/);
    expect(mail.body).not.toContain('{{');
    expect(buildEmail(cfg.emails[1]!, vars).body).not.toContain('comme');
    expect(buildEmail(cfg.emails[2]!, vars).body).toContain('un sujet pour votre entreprise');
    // Sans résumé d'appel, le paragraphe correspondant disparaît
    expect(buildEmail(cfg.emails[4]!, vars).body).not.toMatch(/\n\n\n/);
    expect(buildEmail(cfg.emails[4]!, { ...vars, resume: 'Vous ciblez la Somme.' }).body).toContain('Vous ciblez la Somme.');
  });

  it('script : question posée rapidement, adapté au profil et à la situation constatée', () => {
    const vars = salesVars({ ...personalizationFor(null, settings, cfg), salesperson: 'Adrien' }, cfg);
    const intro = introScript(cfg, 'independent', 'none', vars);
    expect(intro).toMatch(/^Bonjour, Adrien de Paysapro AI\./);
    expect(intro).toContain('comment faites-vous vos devis ?');
    expect(intro.trim().endsWith('?')).toBe(true);
    expect(intro.length).toBeLessThan(330);
    expect(introScript(cfg, 'structure', 'none', vars)).toContain('qui prépare les devis');
    expect(introScript(cfg, 'independent', 'has_crm', vars)).toContain('déjà un logiciel de devis');
    expect(introScript(cfg, 'independent', 'never_prospected', vars)).toContain('à la main ou sur un tableur');
    // Sans nom de commercial : pas de « , de Paysapro » bancal
    expect(introScript(cfg, 'independent', 'none', salesVars(personalizationFor(null, settings, cfg), cfg))).toMatch(/^Bonjour, ici Paysapro AI\./);
    expect(say(cfg.messages.sms, salesVars(personalizationFor(null, settings, cfg), cfg))).toMatch(/^Bonjour, ici Paysapro AI :/);
  });

  it('arbre de conversation : réponses du prospect puis options suivantes', () => {
    const roots = treeChildren(cfg, null);
    expect(roots.length).toBeGreaterThanOrEqual(5);
    const evening = roots.find((r) => /le soir/.test(r.prospectSays))!;
    expect(evening.next).toBe('Combien de temps vous prend un devis, une fois rentré ?');
    expect(treeChildren(cfg, evening.id).map((c) => c.prospectSays)).toEqual(['Ça me prend beaucoup de temps.', 'Ça va, je suis organisé.']);
  });
});

describe('E-mail : liens et image configurables', () => {
  const vars = salesVars(personalizationFor(null, settings, cfg), cfg);
  const mail = buildEmail(cfg.emails[0]!, vars);

  it('sans lien ni image configurés : aucun bouton, aucune image, aucune adresse inventée', () => {
    const html = emailHtml(mail.subject, mail.body, cfg);
    expect(emailLinks(cfg)).toEqual([]);
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('<img');
    expect(emailText(mail.body, cfg)).toBe(mail.body);
    expect(html).toContain('<li style="margin:0 0 6px">Photos et mesures prises sur place');
  });

  it('avec lien, vidéo et image : boutons « Découvrir » et « Voir la démonstration », image cliquable', () => {
    const html = emailHtml(mail.subject, mail.body, withLinks);
    expect(emailLinks(withLinks)).toEqual([
      { label: 'Découvrir Paysapro AI', url: 'https://exemple.test/demo' },
      { label: 'Voir la démonstration', url: 'https://exemple.test/video' },
    ]);
    expect(html).toContain('<a href="https://exemple.test/demo" target="_blank" rel="noopener"><img src="https://exemple.test/capture.png"');
    expect(html).toContain('>Découvrir Paysapro AI</a>');
    expect(html).toContain('>Voir la démonstration</a>');
    expect(emailHtml(mail.subject, mail.body, { ...withLinks, image: { ...withLinks.image, clickable: false } })).not.toContain('<a href="https://exemple.test/demo" target="_blank" rel="noopener"><img');
    // Version texte : les liens passent avant la signature
    const text = emailText(mail.body, withLinks, settings.signature);
    // Sans signature, le dernier paragraphe reste dans le message et les liens passent à la fin
    expect(emailText('Bonjour,\n\nUn paragraphe.', withLinks).endsWith('https://exemple.test/video')).toBe(true);
    expect(emailHtml(mail.subject, mail.body, withLinks, settings.signature)).toContain('color:#5b6660">Adrien<br>Paysapro</p>');
    expect(text).toContain('Découvrir Paysapro AI : https://exemple.test/demo');
    expect(text.endsWith('Adrien\nPaysapro')).toBe(true);
  });

  it('image importée acceptée seulement au format PNG / JPG / WEBP ; texte échappé ; liens sûrs uniquement', () => {
    const data = 'data:image/jpeg;base64,AAAA';
    expect(emailHtml('x', 'y', { ...cfg, image: { dataUrl: data, url: '', clickable: true } })).toContain(`<img src="${data}"`);
    expect(emailHtml('x', 'y', { ...cfg, image: { dataUrl: 'data:text/html;base64,AAAA', url: '', clickable: true } })).not.toContain('<img');
    expect(emailHtml('A <b> & "c"', '<script>alert(1)</script>', cfg)).not.toContain('<script>');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('exemple.test/page')).toBe('https://exemple.test/page');
    expect(safeUrl('pas une adresse')).toBeNull();
  });

  it('SMS pour tout numéro, WhatsApp seulement pour un mobile', () => {
    expect(smsUrl('02 35 12 34 56', 'Bonjour')).toBe('sms:+33235123456?body=Bonjour');
    expect(whatsappUrl('02 35 12 34 56', 'Bonjour')).toBeNull();
    expect(whatsappUrl('06 12 34 56 78', 'Bonjour')).toBe('https://wa.me/33612345678?text=Bonjour');
    expect(smsUrl(null, 'x')).toBeNull();
  });
});

describe('Tarifs : jamais de prix codé en dur', () => {
  it('formule par défaut : bêta gratuite, prix définitif non annoncé', () => {
    expect(dynamicAnswer('price', cfg)).toMatchObject({ short: 'La formule Bêta : 0 € pendant la bêta.', warning: null });
    expect(dynamicAnswer('price', cfg).long).toContain('Le prix définitif sera annoncé avant la fin de la bêta.');
    expect(dynamicAnswer('commitment', cfg).short).toContain('Aucun engagement');
  });

  it('sans formule : aucun chiffre annoncé, avertissement pour le commercial', () => {
    const a = dynamicAnswer('price', bare);
    expect(a.short).not.toMatch(/\d/);
    expect(a.warning).toMatch(/Aucun tarif/);
    expect(dynamicAnswer('trial', bare).warning).toMatch(/ne promettez pas/);
    const objection = cfg.objections.find((o) => o.objection === 'Combien ça coûte ?')!;
    expect(entryAnswer(objection, bare, {}).warning).toMatch(/Aucun tarif/);
  });

  it('avec formules : la réponse reprend exactement les valeurs configurées', () => {
    const c: SalesConfig = { ...cfg, offers: [{ id: '1', name: 'Solo', price: '29 € HT', period: 'par mois', features: 'Recherche, suivi', limits: '', trial: '14 jours', commitment: 'Sans engagement', cta: '' }] };
    expect(dynamicAnswer('price', c)).toMatchObject({ short: 'La formule Solo : 29 € HT par mois.', warning: null });
    expect(dynamicAnswer('price', c).long).toContain('Inclus : Recherche, suivi');
    expect(dynamicAnswer('trial', c).short).toBe('Essai — Solo : 14 jours.');
    expect(dynamicAnswer('commitment', c).short).toBe('Engagement — Solo : Sans engagement.');
  });
});

describe('Base de connaissances : recherche et réponses', () => {
  const kb = new KnowledgeBaseProvider();
  it.each([
    ['Il me demande si ça fait aussi les factures.', 'l-invoice'],
    ['Comment le client signe le devis ?', 'f-sign'],
    ['ça marche sans réseau ?', 'f-offline'],
    ['combien ça coûte', 'q-price'],
    ['on peut utiliser sur plusieurs appareils ?', 'l-devices'],
    ['mes données sont sauvegardées ?', 'd-storage'],
    ["c'est une IA qui fait le devis ?", 'f-auto'],
  ])('« %s » → %s', (question, id) => {
    const top = searchKb(cfg, question)[0]!;
    // Une question peut aussi bien renvoyer la fiche de la base que l'objection équivalente
    const twin: Record<string, string> = { 'q-price': 'o-price', 'l-invoice': 'o-invoice', 'f-offline': 'o-network', 'f-auto': 'o-ai', 'f-sign': 'o-signature', 'd-storage': 'o-data' };
    expect([id, twin[id]]).toContain(top.item.id);
  });

  it('réponse courte, explication et points à éviter ; les limites de la bêta sont dites', () => {
    const a = kb.answer('Le client peut signer à distance ?', cfg)!;
    expect(a.short).toMatch(/^Pas encore/);
    expect(a.avoid).toMatch(/Ne pas promettre/);
    const e = kb.answer('Comment le client signe-t-il ?', cfg)!;
    expect(e.long).toMatch(/pas une signature électronique qualifiée/);
    expect(kb.answer('zzzz qqqq', cfg)).toBeNull();
    expect(searchKb(cfg, '')).toEqual([]);
  });

  it('IA facultative : faits officiels seulement, chiffre ou promesse ajoutés signalés, repli si indisponible', async () => {
    expect(new KnowledgeBaseProvider().canRewrite).toBe(false);
    expect((await new ExternalSalesAIProvider('').rewrite({ task: 'rephrase', text: 'Bonjour', cfg })).provider).toBe('knowledge_base');
    expect(officialFacts(bare).join(' ')).toContain('Tarifs : non communiqués.');
    expect(officialFacts(cfg).join(' ')).toContain('La formule Bêta : 0 € pendant la bêta.');
    let sent: { facts: string[]; system: string } | null = null;
    const ai = new ExternalSalesAIProvider('https://proxy.test', async (_u, init) => {
      sent = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ text: 'Notre outil garanti fait gagner 95 % du temps.' }) };
    });
    const r = await ai.rewrite({ task: 'rephrase', text: 'Le devis est préparé pendant la visite.', cfg });
    expect(r.provider).toBe('ai');
    expect(r.warnings.join(' ')).toMatch(/95 %/);
    expect(r.warnings.join(' ')).toMatch(/garanti/);
    expect(sent!.system).toMatch(/n'inventes jamais/);
    expect(sent!.facts.length).toBeGreaterThan(10);
    const down = new ExternalSalesAIProvider('https://proxy.test', async () => ({ ok: false, status: 503, json: async () => ({}) }));
    expect(await down.rewrite({ task: 'tone', text: 'Texte', cfg })).toMatchObject({ text: 'Texte', provider: 'knowledge_base' });
    expect(checkRewrite('Texte simple.', 'Texte', [])).toEqual([]);
  });
});

describe('Préparation commerciale', () => {
  const base = { phone: null, email: null, website: null, contactFirstName: null, contactLastName: null, activity: null, services: [], nafCode: null, city: null, postalCode: null, doNotContact: false, demo: false };
  it('🔴 sans téléphone, 🟠 incomplet, 🟢 prêt, ⛔ exclu', () => {
    expect(readiness(base).level).toBe('enrich');
    expect(readiness({ ...base, phone: '0612345678' }).level).toBe('incomplete');
    const ok = readiness({ ...base, phone: '0612345678', website: 'https://a.fr', nafCode: '81.30Z', city: 'Rouen' });
    expect(ok.label).toBe('🟢 Prêt à appeler');
    expect(ok.checks.filter((c) => c.ok).map((c) => c.label)).toEqual(['Téléphone', 'Site', 'Activité', 'Localisation']);
    expect(readiness({ ...base, phone: '0612345678', doNotContact: true }).level).toBe('blocked');
  });
});

describe('CRM : résultat d’appel, relance, historique, permissions', () => {
  it('rappel : appel + note + relance dans l’historique, prospect « Contacté »', async () => {
    const api = await setup();
    const p = await api.createProspect({ name: 'Jardins du Nord', city: 'Lille', phone: '0612345678' });
    const dueAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const after = await api.logCallOutcome(p.id, { outcome: 'callback', note: 'Rappeler après 17 h', task: { type: 'call', dueAt, note: 'Rappel demandé par le prospect' } });
    expect(after.status).toBe('contacted');
    expect(after.nextFollowUpAt).toBe(dueAt);
    expect((await api.notesFor(p.id))[0]!.text).toBe('Appel : rappel — Rappeler après 17 h');
    expect((await api.tasksFor(p.id))[0]).toMatchObject({ type: 'call', note: 'Rappel demandé par le prospect', done: false });
    const labels = (await api.timeline(p.id)).map((a) => a.label);
    expect(labels).toContain('Appel : rappel');
    expect(labels.some((l) => l.startsWith('Relance programmée'))).toBe(true);
  });

  it('intéressé → statut « Intéressé » ; pas intéressé → « Pas intéressé » ; numéro invalide → pas un contact', async () => {
    const api = await setup();
    const a = await api.createProspect({ name: 'A Paysage', phone: '0612345678' });
    expect((await api.logCallOutcome(a.id, { outcome: 'demo' })).status).toBe('interested');
    expect((await api.logCallOutcome(a.id, { outcome: 'not_interested' })).status).toBe('not_interested');
    const b = await api.createProspect({ name: 'B Paysage', phone: '0612345679' });
    const invalid = await api.logCallOutcome(b.id, { outcome: 'invalid_number' });
    expect(invalid.status).toBe('new');
    expect(invalid.lastContactAt).toBeNull();
    expect((await api.timeline(b.id)).map((x) => x.label)).toContain('Appel : numéro invalide');
  });

  it('prospect « Ne plus contacter » : aucun appel enregistré', async () => {
    const api = await setup();
    const p = await api.createProspect({ name: 'C Paysage', phone: '0612345678' });
    await api.setDoNotContact(p.id, true);
    await expect(api.logCallOutcome(p.id, { outcome: 'interested' })).rejects.toThrow(/Ne plus contacter/);
    await expect(api.logCallOutcome(p.id, { outcome: 'invalid_number' })).rejects.toThrow(/Ne plus contacter/);
  });

  it('suivi commercial calculé depuis l’historique réel', async () => {
    const api = await setup();
    const p = await api.createProspect({ name: 'D Paysage', phone: '0612345678' });
    await api.logCallOutcome(p.id, { outcome: 'callback', task: { type: 'call', dueAt: new Date().toISOString(), note: '' } });
    await api.logContact(p.id, 'email', 'E-mail envoyé');
    const steps = salesFunnel(await api.allRows(), await api.allActivities(), null);
    expect(Object.fromEntries(steps.map((s) => [s.id, s.count]))).toEqual({ contacts: 1, emails: 1, replies: 0, calls: 1, followups: 1, demos: 0, clients: 0 });
    expect(salesFunnel(await api.allRows(), await api.allActivities(), '2999-01-01').every((s) => s.count === 0)).toBe(true);
  });

  it('permissions : seul un propriétaire / administrateur modifie la base de connaissances', async () => {
    expect(can('owner', 'assistant.admin')).toBe(true);
    expect(can('admin', 'assistant.admin')).toBe(true);
    expect(can('sales', 'assistant.admin')).toBe(false);
    expect(can('viewer', 'assistant.admin')).toBe(false);
    const owner = await setup();
    await owner.saveSalesConfig({ ...cfg, productName: 'Paysapro Pro' });
    expect(salesConfig(await owner.getSettings()).productName).toBe('Paysapro Pro');
    await owner.saveSalesConfig(undefined);
    expect(salesConfig(await owner.getSettings()).productName).toBe('Paysapro AI');
    const sales = await setup({ role: 'sales' });
    await expect(sales.saveSalesConfig(cfg)).rejects.toThrow(/non autorisée/);
    const viewer = await setup({ role: 'viewer' });
    const p = await owner.createProspect({ name: 'E Paysage' });
    await expect(viewer.logCallOutcome(p.id, { outcome: 'other' })).rejects.toThrow(/non autorisée/);
  });
});
