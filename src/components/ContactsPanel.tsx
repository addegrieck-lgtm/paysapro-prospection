// Fiche prospect : résumé simple (Téléphone / E-mail / Site), progression de l'enrichissement en temps réel,
// 📞 CONTACT (tous les numéros, e-mails et sites trouvés, avec confiance, sources, fraîcheur, ✓ / ✗),
// 🔎 SOURCES et 🕘 HISTORIQUE des changements.
import { useState } from 'react';
import { Check, ExternalLink, History, Loader2, Phone, Plus, RotateCcw, Star, X } from 'lucide-react';
import { Card, CardTitle } from './ui/Card';
import { Button, IconButton } from './ui/Button';
import { Dialog } from './ui/Feedback';
import { SelectField, TextField } from './ui/Form';
import { formatDateShort, useAction } from './common';
import { useApp, useCan, useQuery } from '../app/context';
import { ROLE_LABEL, SOURCE_KIND_LABEL, STATUS_DOT, STATUS_LABEL } from '../domain/contacts';
import { strategyLabel } from '../domain/strategies';
import { BAND_LABEL, bandOf } from '../domain/identity';
import type { CompanyEmail, CompanyPhone, CompanyWebsite, Prospect } from '../domain/types';
import type { ContactKind } from '../domain/contactSync';
import { OSM_ATTRIBUTION } from '../providers/company/OpenStreetMapProvider';
import { STAGE_LABEL, type EnrichStage } from '../data/enrichmentEngine';
import { matchCard, parseGoogleCard } from '../domain/googleCard';
import { displayPhone } from '../domain/phone';
import { googleMapsSearchUrl } from '../domain/links';

type AnyContact = CompanyPhone | CompanyEmail | CompanyWebsite;

/** « Aujourd'hui », « Hier », sinon la date. */
export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return 'jamais';
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  return days <= 0 ? 'aujourd’hui' : days === 1 ? 'hier' : formatDateShort(iso);
}

const statusWord = (kind: ContactKind, c: AnyContact) => (kind === 'website' ? (c.status === 'verified' ? 'Confirmé' : c.status === 'to_verify' ? 'À vérifier' : 'Non vérifié') : STATUS_LABEL[c.status]);

/**
 * Résumé en haut de fiche (§62) : l'essentiel, sans jargon.
 *   Téléphone 📞 02 35 … ✓ Vérifié — 96 %
 */
export function ContactSummary({ prospect, blocked = false }: { prospect: Prospect; blocked?: boolean }) {
  const { data } = useQuery((a) => a.contactsFor(prospect.id), [prospect.id, prospect.updatedAt]);
  if (!data) return null;
  const all = [...data.phones, ...data.emails, ...data.websites];
  const sources = new Set(all.filter((c) => c.status !== 'rejected').flatMap((c) => c.evidence.map((e) => e.provider)));
  const lastCheck = [prospect.contactsCheckedAt, ...all.map((c) => c.lastCheckedAt ?? null)].filter(Boolean).sort().at(-1) ?? null;
  const line = (label: string, icon: string, kind: ContactKind, list: AnyContact[]) => {
    const c = list.find((x) => x.isPrimary && x.status !== 'rejected') ?? null;
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
        <span className="w-20 shrink-0 text-sm text-muted">{label}</span>
        {c ? (
          <>
            {blocked || c.status === 'rejected' ? (
              <span className="font-semibold tabular-nums">
                {icon} {kind === 'website' ? c.value : c.display}
              </span>
            ) : (
              <a
                href={kind === 'phone' ? `tel:${(c as CompanyPhone).e164}` : kind === 'email' ? `mailto:${c.value}` : c.display}
                {...(kind === 'website' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="text-lg font-semibold tabular-nums text-brand hover:underline"
              >
                {icon} {kind === 'website' ? c.value : c.display}
              </a>
            )}
            <span className={`text-sm font-medium ${c.status === 'verified' ? 'text-success' : c.status === 'to_verify' ? 'text-warning' : 'text-muted'}`}>
              {c.status === 'verified' ? '✓' : STATUS_DOT[c.status]} {statusWord(kind, c)} — {c.confidence} %
            </span>
            {c.currency === 'historical' && <span className="text-xs text-warning">donnée peut-être ancienne</span>}
          </>
        ) : (
          <span className="text-sm italic text-muted">{label} non trouvé</span>
        )}
      </div>
    );
  };
  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface px-4 py-2">
      {line('Téléphone', '📞', 'phone', data.phones)}
      {line('E-mail', '✉', 'email', data.emails)}
      {line('Site', '🌐', 'website', data.websites)}
      <p className="border-t border-line pt-1.5 text-xs text-muted">
        Sources : {sources.size} · Dernière vérification : {dayLabel(lastCheck)}
      </p>
    </div>
  );
}

const PROGRESS_STAGES: EnrichStage[] = ['identity', 'directory', 'website_search', 'web_search', 'crawling', 'verifying', 'saving'];

/** Progression en temps réel (§63) : Identification ✓ · Recherche du site ✓ · … */
export function EnrichProgress({ stages, detail }: { stages: EnrichStage[]; detail: string | null }) {
  const current = stages.at(-1) ?? null;
  const visible = PROGRESS_STAGES.filter((s) => stages.includes(s) || s === 'identity' || s === 'verifying' || s === 'saving');
  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface p-4" role="status" aria-live="polite">
      <p className="mb-2 font-semibold">Enrichissement en cours…</p>
      <ul className="space-y-1 text-sm">
        {visible.map((s) => {
          const done = stages.includes(s) && s !== current;
          const active = s === current;
          return (
            <li key={s} className={`flex items-center gap-2 ${done ? 'text-success' : active ? 'text-ink' : 'text-muted/70'}`}>
              {done ? <Check className="h-4 w-4" aria-hidden /> : active ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <span className="h-4 w-4" />}
              {STAGE_LABEL[s]}
              {active && detail && <span className="truncate text-xs text-muted">— {detail}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * 📋 Coller une fiche Google : l'utilisateur copie lui-même la fiche (l'application ne lit jamais Google),
 * l'application en extrait téléphone, site, e-mail, note et avis, vérifie qu'elle correspond à l'entreprise,
 * enregistre les éléments cochés, puis le moteur lit et vérifie le site (onSaved).
 */
export function GoogleCardDialog({ prospect, onClose, onSaved }: { prospect: Prospect; onClose: () => void; onSaved: () => void }) {
  const { api } = useApp();
  const run = useAction();
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const card = text.trim().length > 10 ? parseGoogleCard(text) : null;
  const match = card ? matchCard(text, prospect) : null;
  const items = card
    ? [
        ...card.phones.map((p) => ({ key: `p:${p.e164}`, label: `📞 ${displayPhone(p.e164)}${p.mobile ? ' (mobile)' : ''}` })),
        ...card.websites.slice(0, 1).map((w) => ({ key: `w:${w}`, label: `🌐 ${w}` })),
        ...card.emails.map((m) => ({ key: `e:${m}`, label: `✉ ${m}` })),
      ]
    : [];
  // Par défaut tout est coché, sauf si la fiche ressemble à celle d'un homonyme
  const selected = picked ?? new Set(match?.verdict === 'mismatch' ? [] : items.map((i) => i.key));
  const toggle = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setPicked(next);
  };
  const save = async () => {
    if (!card) return;
    const r = await run(
      () =>
        api.applyGoogleCard(prospect.id, {
          phones: card.phones.filter((p) => selected.has(`p:${p.e164}`)).map((p) => p.e164),
          website: card.websites.find((w) => selected.has(`w:${w}`)) ?? null,
          emails: card.emails.filter((m) => selected.has(`e:${m}`)),
          googleUrl: card.googleUrl,
          rating: card.rating,
          reviews: card.reviews,
          facebook: card.facebook,
          instagram: card.instagram,
        }),
      'Fiche Google enregistrée : recherche des autres éléments…',
    );
    if (r) onSaved();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="📋 Coller une fiche Google"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={!card || (selected.size === 0 && !card.rating && !card.googleUrl)}>
            Enregistrer et rechercher le reste
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            <a href={googleMapsSearchUrl(prospect)} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
              Ouvrir la recherche Google Maps <ExternalLink className="inline h-3.5 w-3.5" />
            </a>{' '}
            et ouvrez la fiche de l'entreprise.
          </li>
          <li>Sélectionnez le bloc de la fiche (nom, note, adresse, site, téléphone…), copiez-le et collez-le ci-dessous. Ajoutez le lien de la fiche (« Partager ») si vous le souhaitez.</li>
        </ol>
        <label className="block">
          <span className="sr-only">Texte de la fiche Google</span>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPicked(null);
            }}
            rows={7}
            autoFocus
            placeholder={'Clément Paysage\n4,9 (27)\nPaysagiste\n30 Rue …, 76200 Dieppe\nexemple.fr\n06 00 00 00 00'}
            className="w-full rounded-xl border border-line bg-surface p-3 font-mono text-xs"
          />
        </label>
        {card && match && (
          <>
            <p className={`rounded-xl p-2 ${match.verdict === 'match' ? 'bg-success-soft text-success' : match.verdict === 'mismatch' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}>
              {match.verdict === 'match'
                ? `✓ La fiche correspond à l'entreprise (${[match.name && 'nom', match.postalCode && 'code postal', match.city && 'commune'].filter(Boolean).join(', ')}).`
                : match.verdict === 'mismatch'
                  ? `⚠ Code postal différent (${match.otherPostalCodes.join(', ')} au lieu de ${prospect.postalCode ?? '?'}) : probablement un homonyme. Rien n'est coché ; vérifiez avant d'enregistrer.`
                  : '⚠ Correspondance incertaine (nom, code postal ou commune absents du texte collé) : vérifiez les éléments avant d’enregistrer.'}
            </p>
            {items.length ? (
              <fieldset className="space-y-1">
                <legend className="font-semibold">Éléments trouvés dans le texte collé</legend>
                {items.map((i) => (
                  <label key={i.key} className="flex min-h-10 items-center gap-2">
                    <input type="checkbox" checked={selected.has(i.key)} onChange={() => toggle(i.key)} />
                    <span className="tabular-nums">{i.label}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="text-muted">Aucun téléphone, site ni e-mail dans le texte collé.</p>
            )}
            {(card.rating || card.googleUrl) && (
              <p className="text-muted">
                {card.rating ? `⭐ Note ${String(card.rating).replace('.', ',')}${card.reviews ? ` (${card.reviews} avis)` : ''}` : ''}
                {card.rating && card.googleUrl ? ' · ' : ''}
                {card.googleUrl ? 'lien de la fiche Google' : ''}
              </p>
            )}
            <p className="text-xs text-muted">
              Les éléments cochés sont enregistrés comme votre saisie (100 %, jamais remplacés automatiquement). Ensuite, le moteur lit le site pour
              vérifier qu'il correspond à l'entreprise et chercher l'e-mail et les autres numéros.
            </p>
          </>
        )}
      </div>
    </Dialog>
  );
}

/** 🕘 Historique : anciennes valeurs principales, pourquoi elles ont changé (§42). */
export function ContactHistoryPanel({ prospectId }: { prospectId: string }) {
  const { data = [] } = useQuery((a) => a.contactHistory(prospectId), [prospectId]);
  if (!data.length) return null;
  const label: Record<string, string> = { phone: 'Téléphone', email: 'E-mail', website: 'Site' };
  return (
    <Card>
      <CardTitle icon={<History className="h-5 w-5" />}>Historique des coordonnées</CardTitle>
      <ul className="space-y-2 text-sm">
        {data.slice(0, 20).map((h) => (
          <li key={h.id}>
            <span className="font-medium">{label[h.field]}</span> : <span className="tabular-nums line-through decoration-muted/60">{h.oldValue ?? '—'}</span> → <span className="tabular-nums">{h.newValue ?? 'aucun'}</span>
            <span className="block text-xs text-muted">
              {formatDateShort(h.changedAt)} · {h.reason}
              {h.source ? ` · ${h.source}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ConfidenceBadge({ value, status }: { value: number | null; status: AnyContact['status'] | null }) {
  if (value === null || !status) return null;
  const cls = status === 'verified' ? 'bg-success-soft text-success' : status === 'to_verify' ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-muted';
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`} title={STATUS_LABEL[status]}>
      <span aria-hidden>{STATUS_DOT[status]}</span>
      {value} %
    </span>
  );
}

function ContactRow({ c, kind, prospect, canEdit }: { c: AnyContact; kind: ContactKind; prospect: Prospect; canEdit: boolean }) {
  const { api } = useApp();
  const run = useAction();
  const [open, setOpen] = useState(false);
  const blocked = prospect.doNotContact || prospect.demo;
  const href = kind === 'phone' ? `tel:${(c as CompanyPhone).e164}` : kind === 'email' ? `mailto:${c.value}` : c.display;
  const providers = Array.from(new Set(c.evidence.map((e) => e.provider)));
  return (
    <li className={`rounded-xl border border-line p-3 ${c.status === 'rejected' ? 'opacity-50' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        {kind === 'phone' && <span className="text-xs font-semibold text-muted">{ROLE_LABEL[(c as CompanyPhone).role]}</span>}
        {c.isPrimary && kind !== 'phone' && <span className="text-xs font-semibold text-muted">Principal</span>}
        {blocked || c.status === 'rejected' ? (
          <span className="font-semibold tabular-nums">{c.display}</span>
        ) : (
          <a href={href} {...(kind === 'website' ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="font-semibold tabular-nums text-brand hover:underline">
            {kind === 'website' ? c.value : c.display}
          </a>
        )}
        {c.status === 'rejected' ? <span className="text-xs text-muted">Incorrect</span> : <ConfidenceBadge value={c.confidence} status={c.status} />}
        {c.shared && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">⚠ Numéro partagé</span>}
        {c.currency === 'historical' && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">peut-être ancienne</span>}
        {c.feedback === 'correct' && <span className="text-xs font-semibold text-success">✓ confirmé</span>}
        {kind === 'website' && (c as CompanyWebsite).matchScore !== undefined && (
          <span className={`text-xs font-semibold ${(c as CompanyWebsite).verified ? 'text-success' : 'text-warning'}`}>
            {BAND_LABEL[bandOf((c as CompanyWebsite).matchScore!)]} ({(c as CompanyWebsite).matchScore} %)
          </span>
        )}
        {kind === 'website' && (c as CompanyWebsite).matchScore === undefined && (c as CompanyWebsite).verified && <span className="text-xs font-semibold text-success">site vérifié</span>}
        {kind === 'email' && (c as CompanyEmail).kind === 'nominative' && <span className="text-xs text-muted">nominatif (donnée personnelle)</span>}
        <span className="ml-auto flex">
          {canEdit && c.status === 'rejected' && (
            <IconButton label="Rétablir : finalement correct (annule le « ✗ Incorrect »)" onClick={() => run(() => api.contactFeedback(kind, c.id, 'correct'), 'Coordonnée rétablie et confirmée')}>
              <RotateCcw className="h-4 w-4" />
            </IconButton>
          )}
          {canEdit && c.status !== 'rejected' && !c.manual && (
            <IconButton label="✓ Correct (je confirme cette coordonnée)" onClick={() => run(() => api.contactFeedback(kind, c.id, 'correct'), 'Merci : coordonnée confirmée')}>
              <Check className="h-4 w-4" />
            </IconButton>
          )}
          {canEdit && c.status !== 'rejected' && !c.isPrimary && (
            <IconButton label="Définir comme principal" onClick={() => run(() => api.setPrimaryContact(kind, c.id), 'Coordonnée principale mise à jour')}>
              <Star className="h-4 w-4" />
            </IconButton>
          )}
          {canEdit && c.status !== 'rejected' && (
            <IconButton label="✗ Incorrect (ne correspond pas à l’entreprise)" onClick={() => run(() => api.contactFeedback(kind, c.id, 'incorrect'), 'Merci : coordonnée écartée, le moteur en tiendra compte')}>
              <X className="h-4 w-4" />
            </IconButton>
          )}
        </span>
      </div>
      <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-left text-xs text-muted hover:text-ink" aria-expanded={open}>
        {providers.length > 1 ? `Vérifié par ${providers.length} sources` : `Source : ${providers[0] ?? '—'}`} · trouvé {dayLabel(c.foundAt)}
        {c.lastSeenAt && c.lastSeenAt !== c.foundAt ? ` · revu ${dayLabel(c.lastSeenAt)}` : ''} · {open ? 'masquer le détail' : 'd’où vient cette donnée ?'}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg bg-surface-2 p-2 text-xs">
          <p className="font-medium">Calcul de la confiance</p>
          <ul className="list-disc pl-4">
            {c.confidenceReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="font-medium">Sources</p>
          <ul className="space-y-1">
            {c.evidence.map((e, i) => (
              <li key={i}>
                {SOURCE_KIND_LABEL[e.kind]} — {e.provider} · {formatDateShort(e.at)}
                {e.strategy && ` · recherche : ${strategyLabel(e.strategy)}`}
                {e.matched.length > 0 && ` · concordances : ${e.matched.join(', ')}`}
                {e.url && (
                  <>
                    {' · '}
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brand hover:underline">
                      voir <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function AddContactDialog({ prospectId, onClose }: { prospectId: string; onClose: () => void }) {
  const { api } = useApp();
  const run = useAction();
  const [kind, setKind] = useState<ContactKind>('phone');
  const [value, setValue] = useState('');
  return (
    <Dialog
      open
      onClose={onClose}
      title="Ajouter une coordonnée"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!value.trim()}
            onClick={async () => {
              if (await run(() => api.addManualContact(prospectId, kind, value), 'Coordonnée ajoutée')) onClose();
            }}
          >
            Ajouter
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SelectField label="Type" value={kind} onChange={(v) => setKind(v as ContactKind)} options={[{ value: 'phone', label: 'Téléphone' }, { value: 'email', label: 'E-mail' }, { value: 'website', label: 'Site web' }]} />
        <TextField label="Valeur" value={value} onChange={setValue} autoFocus />
        <p className="text-xs text-muted">Une coordonnée saisie à la main a une confiance de 100 % et n'est jamais remplacée automatiquement.</p>
      </div>
    </Dialog>
  );
}

export function ContactsPanel({ prospect }: { prospect: Prospect }) {
  const canEdit = useCan('prospecting.edit');
  const [adding, setAdding] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const { data } = useQuery((a) => a.contactsFor(prospect.id), [prospect.id]);
  const phones = data?.phones ?? [];
  const emails = data?.emails ?? [];
  const websites = data?.websites ?? [];
  const rejected = [...phones, ...emails, ...websites].filter((c) => c.status === 'rejected').length;
  const visible = <T extends AnyContact>(l: T[]) => l.filter((c) => showRejected || c.status !== 'rejected');
  const section = (title: string, kind: ContactKind, list: AnyContact[], empty: string) => (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {visible(list).length ? (
        <ul className="space-y-2">
          {visible(list).map((c) => (
            <ContactRow key={c.id} c={c} kind={kind} prospect={prospect} canEdit={canEdit} />
          ))}
        </ul>
      ) : (
        <p className="text-sm italic text-muted/80">{empty}</p>
      )}
    </div>
  );
  return (
    <Card>
      <CardTitle icon={<Phone className="h-5 w-5" />} action={canEdit && <Button size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Ajouter</Button>}>
        Contact
      </CardTitle>
      <div className="space-y-4">
        {section('Téléphones', 'phone', phones, 'Téléphone non trouvé — lancez « Enrichir » ou « Rechercher sur le web ».')}
        {section('E-mails', 'email', emails, 'E-mail non trouvé')}
        {section('Sites', 'website', websites, 'Site non trouvé')}
      </div>
      <p className="mt-3 text-xs text-muted">
        🟢 vérifié (≥ 80 %) · 🟠 à vérifier (50–79 %) · ⚪ non vérifié. ✓ Correct = je confirme (100 %) · ☆ principal · ✗ Incorrect. Vos retours
        améliorent les prochaines recherches.
        {rejected > 0 && (
          <button type="button" onClick={() => setShowRejected(!showRejected)} className="ml-1 font-medium text-brand hover:underline">
            {showRejected ? 'Masquer' : 'Afficher'} les {rejected} écartée(s)
          </button>
        )}
      </p>
      {adding && <AddContactDialog prospectId={prospect.id} onClose={() => setAdding(false)} />}
    </Card>
  );
}

/** 🔎 SOURCES : d'où viennent les données de la fiche. */
export function SourcesPanel({ prospect }: { prospect: Prospect }) {
  const { data } = useQuery((a) => a.contactsFor(prospect.id), [prospect.id]);
  const counts = new Map<string, number>();
  for (const c of [...(data?.phones ?? []), ...(data?.emails ?? []), ...(data?.websites ?? [])]) for (const e of c.evidence) counts.set(e.provider, (counts.get(e.provider) ?? 0) + 1);
  const official = Object.values(prospect.fieldSources).filter((s) => s?.type === 'official_api').length;
  const osm = counts.has('OpenStreetMap');
  return (
    <Card>
      <CardTitle>🔎 Sources</CardTitle>
      <ul className="space-y-1 text-sm">
        {official > 0 && <li>Données publiques officielles (SIRENE) — {official} champ(s)</li>}
        {Array.from(counts.entries()).map(([provider, n]) => (
          <li key={provider}>
            {provider} — {n} coordonnée(s)
          </li>
        ))}
        {!official && !counts.size && <li className="text-muted">Aucune source automatique pour l'instant.</li>}
      </ul>
      {osm && <p className="mt-2 text-xs text-muted">Données OpenStreetMap {OSM_ATTRIBUTION}.</p>}
    </Card>
  );
}
