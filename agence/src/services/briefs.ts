import type { Deps } from '../app/context';
import type { Settings } from '../domain/settings';
import type { ContactRow } from '../repo/types';
import { randomToken } from '../lib/crypto';
import { BRIEF_MODULES, type Answers, type BriefModule, parseModules } from '../domain/brief';
import { addContactEvent, siteLink, type StoredFileRef } from './requests';

export interface BriefRow {
  id: number;
  contact_id: number;
  title: string;
  modules: string;
  answers: string;
  files: string;
  step: string;
  status: string;
  token: string;
  sent_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Brief extends Omit<BriefRow, 'modules' | 'answers' | 'files'> {
  modules: BriefModule[];
  answers: Answers;
  files: StoredFileRef[];
}

export const parseBrief = (r: BriefRow): Brief => ({
  ...r,
  modules: parseModules(JSON.parse(r.modules) as string[]),
  answers: JSON.parse(r.answers) as Answers,
  files: JSON.parse(r.files) as StoredFileRef[],
});

export const modulesLabel = (modules: BriefModule[]) => BRIEF_MODULES.filter((m) => modules.includes(m.id)).map((m) => m.label).join(', ');

export async function createBrief(deps: Deps, contactId: number, title: string, modules: BriefModule[]): Promise<number> {
  const now = new Date().toISOString();
  const r = await deps.db.run('INSERT INTO briefs (contact_id, title, modules, token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
    contactId,
    title,
    JSON.stringify(modules),
    randomToken(32),
    now,
    now,
  ]);
  return r.lastId;
}

export async function saveBrief(deps: Deps, b: Brief, patch: { answers?: Answers; modules?: BriefModule[]; files?: StoredFileRef[]; step?: string; status?: string }): Promise<void> {
  await deps.db.run('UPDATE briefs SET answers = ?, modules = ?, files = ?, step = ?, status = ?, updated_at = ? WHERE id = ?', [
    JSON.stringify(patch.answers ?? b.answers),
    JSON.stringify(patch.modules ?? b.modules),
    JSON.stringify(patch.files ?? b.files),
    patch.step ?? b.step,
    patch.status ?? b.status,
    new Date().toISOString(),
    b.id,
  ]);
}

/** Envoie au client le lien personnel de son cahier des charges. */
export async function sendBriefLink(deps: Deps, s: Settings, b: Brief, contact: ContactRow, origin: string): Promise<{ ok: boolean; error?: string }> {
  if (!contact.email) return { ok: false, error: 'Ce contact n’a pas d’adresse e-mail.' };
  const link = siteLink(s, origin, `/client/cahier/${b.token}`);
  const r = await deps.mailer.send({
    to: contact.email,
    subject: `${s.agencyName} — votre cahier des charges`,
    kind: 'cahier',
    replyTo: s.contactEmail || undefined,
    text:
      `Bonjour ${contact.name},\n\n` +
      `Pour préparer votre projet (${modulesLabel(b.modules)}), voici votre cahier des charges à compléter en ligne :\n${link}\n\n` +
      `Il s’agit de questions simples, la plupart à cocher. Comptez 15 à 20 minutes ; vos réponses sont enregistrées à chaque étape et vous pouvez reprendre plus tard avec le même lien.\n` +
      `Si une question ne vous parle pas, laissez-la vide : nous en discuterons ensemble.\n\n${s.agencyName}`,
  });
  if (!r.ok) return r;
  const now = new Date().toISOString();
  await deps.db.run("UPDATE briefs SET sent_at = ?, status = CASE WHEN status = 'brouillon' THEN 'envoye' ELSE status END, updated_at = ? WHERE id = ?", [now, now, b.id]);
  await addContactEvent(deps, contact.id, 'email', `Cahier des charges envoyé : ${b.title}`);
  return { ok: true };
}

/** Le client valide son cahier des charges : il n'est plus modifiable par lui ; l'agence est prévenue. */
export async function submitBrief(deps: Deps, s: Settings, b: Brief, origin: string): Promise<void> {
  const now = new Date().toISOString();
  await deps.db.run("UPDATE briefs SET status = 'termine', submitted_at = ?, updated_at = ? WHERE id = ?", [now, now, b.id]);
  await addContactEvent(deps, b.contact_id, 'note', `Cahier des charges complété par le client : ${b.title}`);
  if (s.notifyEmail) {
    const contact = await deps.db.get<{ name: string; company: string }>('SELECT name, company FROM contacts WHERE id = ?', [b.contact_id]);
    await deps.mailer.send({
      to: s.notifyEmail,
      subject: `Cahier des charges complété : ${contact?.name ?? ''}${contact?.company ? ` (${contact.company})` : ''}`,
      kind: 'notification',
      text: `${b.title}\n\nConsulter : ${siteLink(s, origin, `/admin/cahiers/${b.id}`)}`,
    });
  }
}
