import { beforeEach, describe, expect, it } from 'vitest';
import { AppsScriptEmailProvider, OPT_OUT_LINE, appsScriptCode, inlineImage, newSecret, saveGmailConfig, storedGmailConfig, validScriptUrl } from '../src/providers/gmail';
import { defaultSalesConfig, emailHtml } from '../src/domain/sales';

const URL_OK = 'https://script.google.com/macros/s/AKfycbTEST_abc-123/exec';

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v), removeItem: (k: string) => void memory.delete(k) },
  });
});

/** Faux script Google : vérifie le code secret comme le vrai */
function script(secret: string, reply: Record<string, unknown> = {}) {
  const calls: Record<string, unknown>[] = [];
  const fetchImpl = async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    calls.push({ ...body, contentType: (init.headers as Record<string, string>)['Content-Type'] });
    const ok = body.secret === secret;
    return { ok: true, status: 200, json: async () => (ok ? { ok: true, from: 'moi@gmail.com', remaining: 97, ...reply } : { ok: false, error: 'Accès refusé' }) };
  };
  return { calls, fetchImpl };
}

describe('Envoi direct par Gmail (script Google personnel)', () => {
  it('adresse du script : seule une application Web Google Apps Script est acceptée', () => {
    expect(validScriptUrl(URL_OK)).toBe(true);
    expect(validScriptUrl('https://script.google.com/macros/s/abc/dev')).toBe(false);
    expect(validScriptUrl('https://pirate.test/macros/s/abc/exec')).toBe(false);
    expect(validScriptUrl('http://script.google.com/macros/s/abc/exec')).toBe(false);
    expect(new AppsScriptEmailProvider({ url: 'https://pirate.test/exec', secret: 'x' }).configured).toBe(false);
    expect(new AppsScriptEmailProvider(null).configured).toBe(false);
  });

  it('le script fourni contient le code secret de l’appareil et refuse les autres demandes', () => {
    const a = newSecret();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(newSecret()).not.toBe(a);
    const code = appsScriptCode(a);
    expect(code).toContain(`var SECRET = '${a}';`);
    expect(code).toContain("if (d.secret !== SECRET) return out({ ok: false, error: 'Accès refusé' });");
    expect(code).toContain('MailApp.sendEmail(message);');
    expect(code).toContain('MailApp.getRemainingDailyQuota() < 1');
  });

  it('envoi : texte + version mise en forme, requête simple, quota restant renvoyé', async () => {
    const { calls, fetchImpl } = script('s3');
    const gmail = new AppsScriptEmailProvider({ url: URL_OK, secret: 's3' }, fetchImpl);
    expect(await gmail.ping()).toEqual({ from: 'moi@gmail.com', remaining: 97 });
    const r = await gmail.send({ to: 'contact@clementpaysage76.fr', subject: 'Bonjour', text: `Texte\n\n${OPT_OUT_LINE}`, html: '<p>Texte</p>', name: 'Adrien' });
    expect(r.remaining).toBe(97);
    expect(calls[1]).toMatchObject({ action: 'send', to: 'contact@clementpaysage76.fr', subject: 'Bonjour', html: '<p>Texte</p>', name: 'Adrien', secret: 's3', contentType: 'text/plain;charset=utf-8' });
    expect(String(calls[1]!.text)).toContain('répondez simplement « stop »');
    await expect(gmail.send({ to: 'pas-une-adresse', subject: 'x', text: 'y' })).rejects.toThrow(/destinataire invalide/);
    expect(calls).toHaveLength(2);
  });

  it('image importée : envoyée en pièce intégrée (cid), car Gmail n’affiche pas une image data:', async () => {
    const cfg = { ...defaultSalesConfig(), image: { dataUrl: 'data:image/jpeg;base64,QUJD', url: '', clickable: true } };
    const html = emailHtml('Objet', 'Bonjour,\n\nTexte.', cfg, '', OPT_OUT_LINE);
    expect(html).toContain('répondez simplement « stop »');
    const out = inlineImage(html);
    expect(out.image).toEqual({ type: 'image/jpeg', data: 'QUJD' });
    expect(out.html).toContain('src="cid:apercu"');
    expect(out.html).not.toContain('data:image');
    expect(inlineImage('<img src="https://exemple.test/a.png">').image).toBeNull();
    const { calls, fetchImpl } = script('s3');
    await new AppsScriptEmailProvider({ url: URL_OK, secret: 's3' }, fetchImpl).send({ to: 'a@b.fr', subject: 'x', text: 'y', html });
    expect(calls[0]!.image).toEqual({ type: 'image/jpeg', data: 'QUJD' });
  });

  it('erreurs expliquées : mauvais code, script injoignable, réponse inattendue, quota atteint, non configuré', async () => {
    const wrong = new AppsScriptEmailProvider({ url: URL_OK, secret: 'autre' }, script('s3').fetchImpl);
    await expect(wrong.ping()).rejects.toThrow(/refusé le code secret/);
    const down = new AppsScriptEmailProvider({ url: URL_OK, secret: 's3' }, async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(down.send({ to: 'a@b.fr', subject: 'x', text: 'y' })).rejects.toThrow(/injoignable/);
    const htmlPage = new AppsScriptEmailProvider({ url: URL_OK, secret: 's3' }, async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    }));
    await expect(htmlPage.ping()).rejects.toThrow(/Réponse inattendue/);
    const quota = new AppsScriptEmailProvider({ url: URL_OK, secret: 's3' }, async () => ({ ok: true, status: 200, json: async () => ({ ok: false, error: 'Quota Gmail du jour atteint' }) }));
    await expect(quota.send({ to: 'a@b.fr', subject: 'x', text: 'y' })).rejects.toThrow(/Quota Gmail/);
    await expect(new AppsScriptEmailProvider(null).send({ to: 'a@b.fr', subject: 'x', text: 'y' })).rejects.toThrow(/non configuré/);
  });

  it('réglage conservé sur l’appareil uniquement', () => {
    expect(storedGmailConfig()).toBeNull();
    saveGmailConfig({ url: URL_OK, secret: 's3' });
    expect(new AppsScriptEmailProvider().configured).toBe(true);
    saveGmailConfig(null);
    expect(new AppsScriptEmailProvider().configured).toBe(false);
  });
});
