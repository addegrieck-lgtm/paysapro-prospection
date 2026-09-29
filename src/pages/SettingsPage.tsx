import { useState } from 'react';
import { Database, Download, Plug, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { PageHeader, StickyActions } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card, CardTitle, Badge } from '../components/ui/Card';
import { Alert, ConfirmDialog } from '../components/ui/Feedback';
import { Checkbox, Chip, NumberField, SelectField, TextArea, TextField, Segmented } from '../components/ui/Form';
import { IconButton } from '../components/ui/Button';
import { formatDateShort, nf, useAction } from '../components/common';
import { useApp, useCan, useQuery } from '../app/context';
import { DEPARTMENT_CODES, DEPARTMENTS } from '../domain/geo';
import { NAF_CHOICES, NAF_LABELS } from '../domain/referentials';
import { ROLE_LABEL, CURRENT_PLAN, PLAN_QUOTAS } from '../domain/access';
import { csvProvider, googlePlacesProvider, manualProvider } from '../providers/company';
import { SireneProvider } from '../providers/company/SireneProvider';
import { ENRICHMENT_CONFIG } from '../config';
import { aiProvider } from '../providers/ai';
import { emailProvider } from '../providers/email';
import { downloadText, stampedName } from '../data/export';
import type { Role, Settings, SuppressionKind } from '../domain/types';

export function SettingsPage() {
  const { api, settings, reloadSettings } = useApp();
  const run = useAction();
  const canDelete = useCan('prospecting.delete');
  const [s, setS] = useState<Settings>(settings);
  const [progress, setProgress] = useState<string | null>(null);
  const [wipe, setWipe] = useState(false);
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));

  const save = async () => {
    const zoneChanged = JSON.stringify([...s.targetDepartments].sort()) !== JSON.stringify([...settings.targetDepartments].sort());
    await run(async () => {
      await api.saveSettings(s);
      await reloadSettings();
      // Le critère « zone ciblée » du score dépend des départements ciblés
      if (zoneChanged) await api.rescoreAll((d, t) => setProgress(`Recalcul des scores : ${nf.format(d)} / ${nf.format(t)}`));
      setProgress(null);
    }, 'Paramètres enregistrés');
  };

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Prospection" />
      <div className="space-y-4">
        <Card>
          <CardTitle>Messages</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Nom du SaaS" value={s.saasName} onChange={set('saasName')} />
            <TextField label="Votre nom (auteur des notes)" value={s.userName} onChange={set('userName')} />
            <TextArea label="Signature e-mail" value={s.signature} onChange={set('signature')} rows={3} className="sm:col-span-2" placeholder={'Adrien\nFondateur de Paysapro AI\n06 …'} />
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium">Formule</p>
              <Segmented label="Formule" value={s.formality} onChange={set('formality')} options={[{ value: 'vous', label: 'Vouvoiement' }, { value: 'tu', label: 'Tutoiement' }]} />
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Mode test et limites</CardTitle>
          <div className="space-y-4">
            <Checkbox checked={s.testMode} onChange={set('testMode')}>
              <strong>Mode test</strong> : les messages et campagnes s'ouvrent adressés à votre propre adresse, jamais au prospect. Recommandé pendant la prise en main.
            </Checkbox>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Votre adresse e-mail (mode test)" type="email" value={s.adminEmail} onChange={set('adminEmail')} />
              <NumberField label="Contacts maximum par jour" value={s.dailyContactLimit} onChange={(v) => set('dailyContactLimit')(v ?? 50)} hint="Sécurité anti-spam. Par défaut : 50." />
              <NumberField label="Panier moyen estimé d'un client (€)" value={s.averageDealValue} onChange={set('averageDealValue')} hint="Pour la « valeur potentielle ». Vide = non affichée." />
              <SelectField label="Fuseau horaire" value={s.timezone} onChange={set('timezone')} options={['Europe/Paris', 'America/Guadeloupe', 'America/Martinique', 'America/Cayenne', 'Indian/Reunion', 'Indian/Mayotte'].map((z) => ({ value: z, label: z }))} />
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Ciblage</CardTitle>
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-medium">Codes NAF ciblés (import SIRENE)</p>
              <div className="flex flex-wrap gap-2">
                {NAF_CHOICES.map((c) => (
                  <Chip key={c} selected={s.nafCodes.includes(c)} onClick={() => set('nafCodes')(s.nafCodes.includes(c) ? s.nafCodes.filter((x) => x !== c) : [...s.nafCodes, c])}>
                    {c} · {NAF_LABELS[c]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <SelectField
                label="Départements ciblés (présélectionnés à l'import)"
                value=""
                onChange={(v) => v && set('targetDepartments')([...s.targetDepartments, v])}
                options={[{ value: '', label: 'Ajouter…' }, ...DEPARTMENT_CODES.filter((d) => !s.targetDepartments.includes(d)).map((d) => ({ value: d, label: `${d} — ${DEPARTMENTS[d]![0]}` }))]}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.targetDepartments.map((d) => (
                  <Chip key={d} selected onClick={() => set('targetDepartments')(s.targetDepartments.filter((x) => x !== d))}>
                    {d} {DEPARTMENTS[d]?.[0]} ✕
                  </Chip>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Score minimum conseillé" value={s.minScore} onChange={(v) => set('minScore')(v ?? 0)} max={100} />
              <div className="self-end">
                <Checkbox checked={s.excludeIndividuals} onChange={set('excludeIndividuals')}>
                  Exclure les entrepreneurs individuels à l'import
                </Checkbox>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Moteur d'enrichissement</CardTitle>
          <p className="mb-3 text-sm text-muted">Sources utilisées par « 🚀 Enrichir » et « 📞 Maximiser les téléphones ». Toutes gratuites ; chacune peut être désactivée.</p>
          <div className="space-y-1">
            <Checkbox checked={s.providers.official} onChange={(v) => set('providers')({ ...s.providers, official: v })}>
              Données publiques officielles (SIRENE — API Recherche d'entreprises) : identité, adresse, NAF, statut, effectif
            </Checkbox>
            <Checkbox checked={s.providers.directory} onChange={(v) => set('providers')({ ...s.providers, directory: v })}>
              Annuaire public OpenStreetMap : téléphone, site, e-mail publiés (© contributeurs OpenStreetMap, ODbL)
            </Checkbox>
            <Checkbox checked={s.providers.website} onChange={(v) => set('providers')({ ...s.providers, website: v })}>
              Site officiel de l'entreprise : accueil, contact, mentions légales {ENRICHMENT_CONFIG.webProxyUrl ? '' : '(relais web non configuré : voir worker/README.md)'}
            </Checkbox>
            <Checkbox checked={s.providers.websiteDiscovery} onChange={(v) => set('providers')({ ...s.providers, websiteDiscovery: v })}>
              Rechercher le site officiel quand il est inconnu (domaines plausibles, retenus seulement si la page mentionne le SIREN ou le nom + la commune)
            </Checkbox>
            <div className="pt-2">
              <Checkbox checked={s.autoQualify} onChange={set('autoQualify')}>
                <strong>Ajouter automatiquement les prospects qualifiés au CRM</strong> (statut « À contacter ») : entreprise active + téléphone vérifié 🟢
              </Checkbox>
            </div>
          </div>
          {!ENRICHMENT_CONFIG.webProxyUrl && (
            <div className="mt-3">
              <Alert tone="info" title="Relais web gratuit non configuré">
                La lecture des sites officiels (souvent la meilleure source de téléphones) nécessite un petit relais gratuit (Cloudflare Workers, sans carte bancaire). Voir le fichier
                worker/README.md du projet. Le reste fonctionne sans.
              </Alert>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle icon={<Plug className="h-5 w-5" />}>Fournisseurs</CardTitle>
          <ul className="divide-y divide-line text-sm">
            <Provider
              name="API Recherche d’entreprises — enrichissement"
              status="active"
              desc={`Données publiques officielles (SIRENE / INSEE), gratuites et sans clé. ${ENRICHMENT_CONFIG.rateLimitPerSecond} requêtes/s maximum, cache ${ENRICHMENT_CONFIG.cacheDays} jours, lots de ${ENRICHMENT_CONFIG.batchSize} (variables VITE_ENRICHMENT_*).`}
            />
            <Provider name={new SireneProvider().label} status="active" desc={new SireneProvider().description} />
            <Provider name={csvProvider.label} status="active" desc={csvProvider.description} />
            <Provider name={manualProvider.label} status="active" desc={manualProvider.description} />
            <Provider name={emailProvider.label} status="active" desc="Envoi via votre propre messagerie (lien pré-rempli). Resend, Brevo, Gmail… pourront être ajoutés via EmailProvider, désactivés par défaut." />
            <Provider name="IA (génération de messages)" status={aiProvider.configured ? 'active' : 'off'} desc={aiProvider.configured ? 'Proxy IA configuré (VITE_AI_ENDPOINT).' : 'IA non configurée — les modèles dynamiques sont utilisés. Voir PROSPECTING.md.'} />
            <Provider name={googlePlacesProvider.label} status="off" desc={googlePlacesProvider.description} />
            <Provider name="Google Business Profile" status="off" desc="Connexion Google : Non connecté. Intégration officielle possible plus tard (nécessite un compte Google Cloud et un serveur). Dernière synchronisation : —" />
          </ul>
        </Card>

        <Card>
          <CardTitle>Accès</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Rôle (aperçu des permissions)" value={s.role} onChange={(v) => set('role')(v as Role)} options={(Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))} hint="Utilisateur unique aujourd'hui : laissez « Propriétaire »." />
            <div className="text-sm">
              <p className="mb-1.5 font-medium">Quotas (plan {CURRENT_PLAN})</p>
              <p className="text-muted">Prospects, exports, générations IA et campagnes : illimités. Plans FREE ({PLAN_QUOTAS.FREE.prospects_limit} prospects), PRO ({nf.format(PLAN_QUOTAS.PRO.prospects_limit)}), BUSINESS ({nf.format(PLAN_QUOTAS.BUSINESS.prospects_limit)}) prêts pour une offre future.</p>
            </div>
          </div>
        </Card>

        <SuppressionList />

        <Card>
          <CardTitle icon={<Database className="h-5 w-5" />}>Données</CardTitle>
          <Alert tone="info">Vos prospects sont enregistrés uniquement sur cet appareil. Faites une sauvegarde régulière (et avant de changer de navigateur).</Alert>
          {progress && <p className="mt-3 text-sm text-muted" role="status">{progress}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<Download className="h-5 w-5" />}
              onClick={async () => {
                const b = await run(() => api.exportBackup());
                if (b) downloadText(JSON.stringify(b), stampedName('sauvegarde-prospection', 'json'), 'application/json');
              }}
            >
              Sauvegarder (JSON)
            </Button>
            <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 font-semibold hover:bg-surface-2">
              <Upload className="h-5 w-5" aria-hidden /> Restaurer
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!window.confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
                  await run(async () => api.restoreBackup(JSON.parse(await file.text())), 'Sauvegarde restaurée');
                  await reloadSettings();
                }}
              />
            </label>
            <Button variant="secondary" icon={<RefreshCw className="h-5 w-5" />} onClick={async () => {
              const n = await run(() => api.rescoreAll((d, t) => setProgress(`Recalcul des scores : ${nf.format(d)} / ${nf.format(t)}`)));
              setProgress(n !== undefined ? `${nf.format(n)} score(s) mis à jour.` : null);
            }}>
              Recalculer les scores
            </Button>
            {canDelete && (
              <Button variant="danger" icon={<Trash2 className="h-5 w-5" />} onClick={() => setWipe(true)}>
                Tout supprimer
              </Button>
            )}
          </div>
        </Card>
      </div>

      {dirty && (
        <StickyActions>
          <Button variant="secondary" onClick={() => setS(settings)}>
            Annuler
          </Button>
          <Button block onClick={save}>
            Enregistrer les paramètres
          </Button>
        </StickyActions>
      )}
      <ConfirmDialog
        open={wipe}
        title="Supprimer toutes les données ?"
        message="Prospects, notes, relances, segments, campagnes, historique et liste de suppression seront effacés de cet appareil. Les paramètres et modèles sont conservés."
        confirmLabel="Tout supprimer"
        danger
        requireText="SUPPRIMER"
        onClose={() => setWipe(false)}
        onConfirm={async () => {
          await run(() => api.clearWorkspace(), 'Données supprimées');
          setWipe(false);
        }}
      />
    </>
  );
}

function Provider({ name, status, desc }: { name: string; status: 'active' | 'off'; desc: string }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{name}</p>
        <p className="text-muted">{desc}</p>
      </div>
      <Badge tone={status === 'active' ? 'success' : 'neutral'}>{status === 'active' ? 'Actif · gratuit' : 'Désactivé'}</Badge>
    </li>
  );
}

function SuppressionList() {
  const { api } = useApp();
  const run = useAction();
  const { data = [] } = useQuery((a) => a.listSuppression(), []);
  const [kind, setKind] = useState<SuppressionKind>('email');
  const [value, setValue] = useState('');
  return (
    <Card>
      <CardTitle icon={<ShieldCheck className="h-5 w-5" />}>RGPD — liste de suppression ({data.length})</CardTitle>
      <p className="mb-3 text-sm text-muted">
        Entreprises ou personnes ayant exercé leur droit d'opposition ou demandé leur suppression. Elles ne sont jamais réimportées ni contactées. Remplie automatiquement par « Ne plus contacter » et par la suppression RGPD d'une fiche.
      </p>
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <SelectField label="Type" value={kind} onChange={(v) => setKind(v as SuppressionKind)} options={[{ value: 'email', label: 'E-mail' }, { value: 'phone', label: 'Téléphone' }, { value: 'siren', label: 'SIREN' }, { value: 'siret', label: 'SIRET' }]} />
        <TextField label="Valeur" value={value} onChange={setValue} />
        <Button
          disabled={!value.trim()}
          onClick={async () => {
            await run(() => api.addSuppression(kind, value, 'Ajout manuel (demande reçue)'), 'Ajouté à la liste de suppression');
            setValue('');
          }}
        >
          Ajouter
        </Button>
      </div>
      {data.length > 0 && (
        <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto text-sm">
          {data.map((e) => (
            <li key={e.id} className="flex items-center gap-2 py-2">
              <span className="w-16 shrink-0 text-xs font-semibold uppercase text-muted">{e.kind}</span>
              <span className="min-w-0 flex-1 truncate">{e.value}</span>
              <span className="hidden text-xs text-muted sm:inline">
                {e.reason} · {formatDateShort(e.createdAt)}
              </span>
              <IconButton label="Retirer de la liste" onClick={() => run(() => api.removeSuppression(e.id), 'Retiré')}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
