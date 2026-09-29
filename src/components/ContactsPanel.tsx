// Fiche prospect : 📞 CONTACT (tous les numéros, e-mails et sites trouvés, avec confiance et sources) et 🔎 SOURCES.
import { useState } from 'react';
import { Check, ExternalLink, Phone, Plus, X } from 'lucide-react';
import { Card, CardTitle } from './ui/Card';
import { Button, IconButton } from './ui/Button';
import { Dialog } from './ui/Feedback';
import { SelectField, TextField } from './ui/Form';
import { formatDateShort, useAction } from './common';
import { useApp, useCan, useQuery } from '../app/context';
import { ROLE_LABEL, SOURCE_KIND_LABEL, STATUS_DOT, STATUS_LABEL } from '../domain/contacts';
import type { CompanyEmail, CompanyPhone, CompanyWebsite, Prospect } from '../domain/types';
import type { ContactKind } from '../domain/contactSync';
import { OSM_ATTRIBUTION } from '../providers/company/OpenStreetMapProvider';

type AnyContact = CompanyPhone | CompanyEmail | CompanyWebsite;

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
        {c.status === 'rejected' ? <span className="text-xs text-muted">Écarté</span> : <ConfidenceBadge value={c.confidence} status={c.status} />}
        {c.shared && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">⚠ Numéro partagé</span>}
        {kind === 'website' && (c as CompanyWebsite).verified && <span className="text-xs font-semibold text-success">site vérifié</span>}
        {kind === 'email' && (c as CompanyEmail).kind === 'nominative' && <span className="text-xs text-muted">nominatif (donnée personnelle)</span>}
        <span className="ml-auto flex">
          {canEdit && c.status !== 'rejected' && !(c.isPrimary && c.manual) && (
            <IconButton label="Définir comme principal (je confirme)" onClick={() => run(() => api.setPrimaryContact(kind, c.id), 'Coordonnée validée')}>
              <Check className="h-4 w-4" />
            </IconButton>
          )}
          {canEdit && c.status !== 'rejected' && (
            <IconButton label="Écarter (ne correspond pas à l’entreprise)" onClick={() => run(() => api.rejectContact(kind, c.id), 'Coordonnée écartée')}>
              <X className="h-4 w-4" />
            </IconButton>
          )}
        </span>
      </div>
      <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-left text-xs text-muted hover:text-ink" aria-expanded={open}>
        Sources concordantes : {providers.length} ({providers.join(', ')}) · {open ? 'masquer le détail' : 'pourquoi ?'}
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
        {section('Téléphones', 'phone', phones, 'Non disponible — lancez « Enrichir » ou « Rechercher sur le web ».')}
        {section('E-mails', 'email', emails, 'Non disponible')}
        {section('Sites', 'website', websites, 'Non disponible')}
      </div>
      <p className="mt-3 text-xs text-muted">
        🟢 vérifié (≥ 80 %) · 🟠 à vérifier (50–79 %) · ⚪ non vérifié. ✓ = je confirme (100 %), ✕ = ne correspond pas.
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
