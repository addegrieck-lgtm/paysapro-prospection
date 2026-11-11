// S&S Social Finder : présentation, téléchargement depuis GitHub et lien vers le logiciel local.
// Social Finder ne peut pas tourner sur ce site (GitHub Pages n'héberge que des pages fixes) : il fonctionne
// sur l'ordinateur (Python, START.bat) et s'ouvre dans le navigateur à l'adresse http://127.0.0.1:8765.
import { Download, ExternalLink, FileUp, FolderGit2, MonitorPlay, Radar, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { ButtonLink, buttonClass } from '../components/ui/Button';

export const SOCIAL_FINDER = {
  repo: 'https://github.com/addegrieck-lgtm/paysapro-prospection/tree/main/social-finder',
  zip: 'https://github.com/addegrieck-lgtm/paysapro-prospection/archive/refs/heads/main.zip',
  docs: 'https://github.com/addegrieck-lgtm/paysapro-prospection/blob/main/social-finder/README.md',
  python: 'https://www.python.org/downloads/',
  local: 'http://127.0.0.1:8765',
};

const STEPS = [
  { title: 'Installer Python (une seule fois)', text: <>Téléchargez Python 3.12 et cochez <b>« Add python.exe to PATH »</b> pendant l’installation.</> },
  { title: 'Télécharger Social Finder', text: <>Cliquez « Télécharger (ZIP) », puis décompressez le fichier. Le logiciel est dans le dossier <code>social-finder</code>.</> },
  { title: 'Lancer', text: <>Double-cliquez sur <code>social-finder\START.bat</code>. La première fois, l’installation prend 1 à 2 minutes, puis le logiciel s’ouvre dans votre navigateur.</> },
];

export function SocialFinderPage() {
  const external = { target: '_blank', rel: 'noreferrer' };
  return (
    <>
      <PageHeader title="S&S Social Finder" subtitle="Trouver des entreprises sur Instagram et Facebook, puis les importer ici pour chercher leurs coordonnées." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<Radar className="h-5 w-5" />}>Ce que fait Social Finder</CardTitle>
          <ul className="list-disc space-y-1.5 pl-5 text-ink">
            <li>Découvre les profils Instagram et pages Facebook d’une ville et d’une activité (ex. « Restaurants au Havre »).</li>
            <li>Calcule deux scores : <b>confiance</b> (est-ce bien cette entreprise ?) et <b>potentiel commercial</b> pour l’agence.</li>
            <li>Prépare des messages personnalisés à envoyer vous-même en message privé.</li>
            <li>Envoie les meilleurs prospects vers <b>Prospection</b>, qui cherche ensuite e-mail, téléphone et SIRENE.</li>
          </ul>
          <p className="mt-3 flex items-start gap-2 text-sm text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Logiciel gratuit qui fonctionne sur votre ordinateur : données stockées localement, aucune collecte automatique sur Facebook ou Instagram.
          </p>
        </Card>

        <Card>
          <CardTitle icon={<MonitorPlay className="h-5 w-5" />}>Déjà installé ?</CardTitle>
          <p className="text-ink">Lancez <code>START.bat</code> sur votre ordinateur, puis ouvrez le logiciel :</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={SOCIAL_FINDER.local} {...external} className={buttonClass('primary')}>
              <ExternalLink className="h-5 w-5" aria-hidden />Ouvrir Social Finder
            </a>
          </div>
          <p className="mt-3 text-sm text-muted">Le lien ne fonctionne que sur l’ordinateur où Social Finder est lancé (adresse {SOCIAL_FINDER.local}).</p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle icon={<Download className="h-5 w-5" />}>Installer sur Windows</CardTitle>
        <ol className="space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand">{i + 1}</span>
              <div><p className="font-semibold text-ink">{s.title}</p><p className="text-muted">{s.text}</p></div>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={SOCIAL_FINDER.python} {...external} className={buttonClass('secondary')}>Python</a>
          <a href={SOCIAL_FINDER.zip} className={buttonClass('primary')}><Download className="h-5 w-5" aria-hidden />Télécharger (ZIP)</a>
          <a href={SOCIAL_FINDER.repo} {...external} className={buttonClass('secondary')}><FolderGit2 className="h-5 w-5" aria-hidden />Voir sur GitHub</a>
          <a href={SOCIAL_FINDER.docs} {...external} className={buttonClass('ghost')}>Mode d’emploi</a>
        </div>
      </Card>

      <Card className="mt-4">
        <CardTitle icon={<FileUp className="h-5 w-5" />}>Importer les prospects trouvés</CardTitle>
        <ol className="list-decimal space-y-1.5 pl-5 text-ink">
          <li>Dans Social Finder : <b>Prospects → Envoyer vers Prospection</b>, puis téléchargez le fichier.</li>
          <li>Ici, dans l’espace <b>Signe &amp; Seine</b> : <b>Import &amp; enrichissement → CSV</b>, choisissez le fichier. Les colonnes sont reconnues automatiquement.</li>
          <li>Lancez la recherche des coordonnées sur les fiches importées.</li>
        </ol>
        <div className="mt-4"><ButtonLink to="/import" variant="soft">Aller à l’import</ButtonLink></div>
      </Card>
    </>
  );
}
