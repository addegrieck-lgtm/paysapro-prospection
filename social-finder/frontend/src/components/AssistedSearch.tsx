// Recherche assistée : le logiciel prépare les requêtes, VOUS les ouvrez et choisissez les profils pertinents.
// Aucune navigation ni collecte automatique sur Facebook / Instagram.
import { useState } from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { api } from '../lib/api';
import type { AssistedQuery } from '../lib/types';
import { PlatformIcon } from './brand';
import { Button, Label, Textarea, useToast } from './ui';

export default function AssistedSearch({ queries, context, onAdded }: {
  queries: AssistedQuery[]; context: { activity?: string; city?: string; department?: string; region?: string; campaign_id?: number | null }; onAdded?: (ids: number[]) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const add = async () => {
    const profiles = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [url, name, bio] = l.split('|').map((x) => x.trim());
      return { url, name: name || null, bio: bio || null };
    });
    if (!profiles.length) return;
    setBusy(true);
    try {
      const r = await api.post<{ added: number; already_known: number; invalid: string[]; suppressed: number; company_ids: number[] }>('/assisted/profiles', { profiles, ...context });
      toast(`${r.added} ajoutée(s), ${r.already_known} déjà connue(s)${r.invalid.length ? `, ${r.invalid.length} URL non reconnue(s)` : ''}${r.suppressed ? `, ${r.suppressed} en liste de suppression` : ''}`, 'good');
      setText('');
      onAdded?.(r.company_ids);
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div>
        <p className="text-[13px] text-muted mb-2">1. Ouvrez les requêtes préparées dans votre navigateur et repérez les profils professionnels.</p>
        <ul className="space-y-1.5 max-h-80 overflow-y-auto scroll-thin pr-1">
          {queries.map((q) => (
            <li key={q.query} className="flex items-center gap-2 rounded-lg border border-line bg-paper/60 px-3 py-2">
              <PlatformIcon platform={q.platform} />
              <code className="flex-1 min-w-0 truncate text-[12.5px] text-ink-2">{q.query}</code>
              {Object.entries(q.links).map(([name, href]) => (
                <a key={name} href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-seine hover:underline capitalize">
                  {name}<ExternalLink className="size-3" />
                </a>
              ))}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-[13px] text-muted mb-2">2. Collez les adresses des profils retenus (une par ligne). Facultatif : <code>url | nom | description</code></p>
        <Label hint="les scores sont calculés à partir de ce que vous indiquez">Profils trouvés</Label>
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'https://www.instagram.com/nom_du_compte/\nhttps://www.facebook.com/nomdelapage | Nom commercial | Restaurant au Havre, cuisine maison'} />
        <Button variant="primary" className="mt-3" loading={busy} onClick={add}><Plus className="size-4" />Ajouter et évaluer</Button>
      </div>
    </div>
  );
}
