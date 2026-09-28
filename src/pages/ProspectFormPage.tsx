// Création / modification / enrichissement manuel gratuit d'une fiche prospect.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Search } from 'lucide-react';
import { PageHeader, StickyActions } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { Checkbox, Chip, NumberField, TextField } from '../components/ui/Form';
import { Alert } from '../components/ui/Feedback';
import { Skeleton } from '../components/ui/Extras';
import { useAction } from '../components/common';
import { useApp, useQuery } from '../app/context';
import { SERVICES } from '../domain/referentials';
import { departmentFromPostalCode, normalizeDepartment, regionOfDepartment } from '../domain/geo';
import { clean, normDate, normEmail, normPhone, normPostalCode, normSiren, normSiret, normUrl, formatPhone } from '../domain/normalize';
import { googleSearchUrl } from '../domain/links';
import type { ProspectInput } from '../domain/prospect';
import type { Prospect, ServiceTag } from '../domain/types';

type Form = Record<
  | 'name'
  | 'tradeName'
  | 'siren'
  | 'siret'
  | 'nafCode'
  | 'activity'
  | 'creationDate'
  | 'address'
  | 'postalCode'
  | 'city'
  | 'department'
  | 'contactFirstName'
  | 'contactLastName'
  | 'phone'
  | 'email'
  | 'website'
  | 'googleUrl'
  | 'googleCategory'
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'tiktok'
  | 'interventionArea'
  | 'owner',
  string
>;

function toForm(p?: Prospect): Form {
  return {
    name: p?.name ?? '',
    tradeName: p?.tradeName ?? '',
    siren: p?.siren ?? '',
    siret: p?.siret ?? '',
    nafCode: p?.nafCode ?? '',
    activity: p?.activity ?? '',
    creationDate: p?.creationDate ?? '',
    address: p?.address ?? '',
    postalCode: p?.postalCode ?? '',
    city: p?.city ?? '',
    department: p?.department ?? '',
    contactFirstName: p?.contactFirstName ?? '',
    contactLastName: p?.contactLastName ?? '',
    phone: p?.phone ? formatPhone(p.phone) : '',
    email: p?.email ?? '',
    website: p?.website ?? '',
    googleUrl: p?.googleUrl ?? '',
    googleCategory: p?.googleCategory ?? '',
    facebook: p?.facebook ?? '',
    instagram: p?.instagram ?? '',
    linkedin: p?.linkedin ?? '',
    tiktok: p?.tiktok ?? '',
    interventionArea: p?.interventionArea ?? '',
    owner: p?.owner ?? '',
  };
}

export function ProspectFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useApp();
  const run = useAction();
  const { data: existing, loading } = useQuery((a) => (id ? a.getProspect(id) : Promise.resolve(undefined)), [id]);
  const [f, setF] = useState<Form>(toForm());
  const [rating, setRating] = useState<number | null>(null);
  const [reviews, setReviews] = useState<number | null>(null);
  const [headcount, setHeadcount] = useState<number | null>(null);
  const [services, setServices] = useState<ServiceTag[]>([]);
  const [checkedToday, setCheckedToday] = useState(false);
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (existing && !loaded) {
      setF(toForm(existing));
      setRating(existing.googleRating);
      setReviews(existing.googleReviews);
      setHeadcount(existing.headcount);
      setServices(existing.services);
      setLoaded(true);
    }
  }, [existing, loaded]);

  const set = (k: keyof Form) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const errors: Partial<Record<keyof Form, string>> = {};
  const check = (k: keyof Form, fn: (v: string) => string | null, msg: string) => {
    if (f[k].trim() && !fn(f[k])) errors[k] = msg;
  };
  check('phone', normPhone, 'Numéro français attendu (10 chiffres).');
  check('email', normEmail, 'Adresse e-mail invalide.');
  check('website', normUrl, 'Adresse de site invalide.');
  check('googleUrl', normUrl, 'Lien invalide.');
  check('siren', normSiren, '9 chiffres attendus.');
  check('siret', normSiret, '14 chiffres attendus.');
  check('postalCode', normPostalCode, '5 chiffres attendus.');
  check('creationDate', normDate, 'Date invalide.');
  if (!f.name.trim()) errors.name = 'Obligatoire.';

  const save = async () => {
    if (Object.keys(errors).length) return;
    const postalCode = normPostalCode(f.postalCode);
    const department = normalizeDepartment(f.department) ?? departmentFromPostalCode(postalCode);
    const input: ProspectInput = {
      name: f.name.trim(),
      tradeName: clean(f.tradeName),
      siren: normSiren(f.siren) ?? (normSiret(f.siret)?.slice(0, 9) || null),
      siret: normSiret(f.siret),
      nafCode: clean(f.nafCode),
      activity: clean(f.activity),
      creationDate: normDate(f.creationDate),
      address: clean(f.address),
      postalCode,
      city: clean(f.city),
      department,
      region: regionOfDepartment(department),
      contactFirstName: clean(f.contactFirstName),
      contactLastName: clean(f.contactLastName),
      phone: normPhone(f.phone),
      email: normEmail(f.email),
      website: normUrl(f.website),
      googleUrl: normUrl(f.googleUrl),
      googleCategory: clean(f.googleCategory),
      googleRating: rating,
      googleReviews: reviews !== null ? Math.round(reviews) : null,
      facebook: normUrl(f.facebook),
      instagram: normUrl(f.instagram),
      linkedin: normUrl(f.linkedin),
      tiktok: normUrl(f.tiktok),
      headcount: headcount !== null ? Math.round(headcount) : null,
      services,
      interventionArea: clean(f.interventionArea),
      owner: clean(f.owner),
      ...(checkedToday ? { googleCheckedAt: new Date().toISOString() } : {}),
    };
    const saved = await run(() => (existing ? api.updateProspect(existing.id, input, 'Fiche enrichie manuellement') : api.createProspect(input, 'manual')), 'Fiche enregistrée');
    if (saved) navigate(`/prospects/${saved.id}`, { replace: true });
  };

  if (id && (loading || !loaded)) return <Skeleton className="h-64" />;

  const field = (k: keyof Form, label: string, extra: Partial<Parameters<typeof TextField>[0]> = {}) => (
    <TextField label={label} value={f[k]} onChange={set(k)} error={errors[k]} {...extra} />
  );

  return (
    <>
      <PageHeader title={existing ? 'Modifier / enrichir' : 'Nouveau prospect'} subtitle={existing?.name} back={existing ? `/prospects/${existing.id}` : '/prospects'} />
      {existing?.demo && (
        <div className="mb-4">
          <Alert tone="warning">DONNÉE DE DÉMONSTRATION : entreprise fictive.</Alert>
        </div>
      )}
      <div className="space-y-4">
        <Card>
          <CardTitle>Entreprise</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('name', 'Raison sociale *')}
            {field('tradeName', 'Nom commercial')}
            {field('siren', 'SIREN', { inputMode: 'numeric' })}
            {field('siret', 'SIRET', { inputMode: 'numeric' })}
            {field('nafCode', 'Code NAF', { placeholder: '81.30Z' })}
            {field('activity', 'Activité')}
            {field('creationDate', 'Date de création', { type: 'date' })}
            <NumberField label="Effectif (personnes)" value={headcount} onChange={setHeadcount} />
          </div>
        </Card>

        <Card>
          <CardTitle>Coordonnées</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('address', 'Adresse', { className: 'sm:col-span-2' })}
            {field('postalCode', 'Code postal', { inputMode: 'numeric' })}
            {field('city', 'Ville')}
            {field('department', 'Département', { hint: 'Déduit du code postal si vide.' })}
            {field('contactFirstName', 'Prénom du contact')}
            {field('contactLastName', 'Nom du contact')}
            {field('phone', 'Téléphone', { type: 'tel' })}
            {field('email', 'E-mail', { type: 'email' })}
            {field('website', 'Site internet', { placeholder: 'www.exemple.fr' })}
          </div>
        </Card>

        <Card>
          <CardTitle
            action={
              f.name && (
                <a href={googleSearchUrl({ name: f.name, tradeName: clean(f.tradeName), city: clean(f.city) })} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
                  <Search className="h-4 w-4" aria-hidden /> Rechercher sur Google
                </a>
              )
            }
          >
            Google et réseaux (saisie manuelle)
          </CardTitle>
          <p className="mb-4 text-sm text-muted">Ouvrez la recherche Google, vérifiez la fiche de l'entreprise, puis reportez ici ce que vous avez constaté. Laissez vide ce que vous ne savez pas.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('googleUrl', 'URL de la fiche Google', { className: 'sm:col-span-2' })}
            <NumberField label="Note Google" value={rating} onChange={setRating} max={5} suffix="/ 5" />
            <NumberField label="Nombre d'avis" value={reviews} onChange={setReviews} />
            {field('googleCategory', 'Catégorie principale')}
            <div className="self-end">
              <Checkbox checked={checkedToday} onChange={setCheckedToday}>
                Vérifié sur Google aujourd'hui
              </Checkbox>
            </div>
            {field('facebook', 'Facebook')}
            {field('instagram', 'Instagram')}
            {field('linkedin', 'LinkedIn')}
            {field('tiktok', 'TikTok')}
          </div>
        </Card>

        <Card>
          <CardTitle>Qualification</CardTitle>
          <p className="mb-2 text-sm font-medium">Prestations constatées</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {SERVICES.map((s) => (
              <Chip key={s.id} selected={services.includes(s.id)} onClick={() => setServices((l) => (l.includes(s.id) ? l.filter((x) => x !== s.id) : [...l, s.id]))}>
                {s.label}
              </Chip>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('interventionArea', "Zone d'intervention", { placeholder: 'Ex. Rouen et 30 km' })}
            {field('owner', 'Responsable commercial')}
          </div>
        </Card>
      </div>
      <StickyActions>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Annuler
        </Button>
        <Button block onClick={save} disabled={Object.keys(errors).length > 0}>
          Enregistrer
        </Button>
      </StickyActions>
    </>
  );
}
