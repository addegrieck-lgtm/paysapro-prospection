// Lien avec Paysapro Prospection : fichier d'import prêt pour l'espace Signe & Seine.
import { useEffect, useState } from 'react';
import { ArrowUpRight, Download, ExternalLink } from 'lucide-react';

/** Paysapro Prospection en ligne (GitHub Pages), page d'import. */
export const PROSPECTION_IMPORT_URL = 'https://addegrieck-lgtm.github.io/paysapro-prospection/#/import';
import { api, qs } from '../lib/api';
import { Button, Input, Label, Modal, Toggle } from './ui';

export default function ProspectionExport({ open, onClose, ids, campaignId, onDone }: {
  open: boolean; onClose: () => void; ids: number[]; campaignId?: string; onDone?: () => void;
}) {
  const [minConf, setMinConf] = useState(75);
  const [minCom, setMinCom] = useState(0);
  const [onlyNew, setOnlyNew] = useState(true);
  const [preview, setPreview] = useState<{ count: number; already_exported: number } | null>(null);
  const params = ids.length ? { ids: ids.join(',') } : { min_confidence: minConf, min_commercial: minCom, only_new: onlyNew, campaign_id: campaignId };
  const query = qs(params);
  useEffect(() => {
    if (open) api.get<{ count: number; already_exported: number }>(`/export/prospection.csv${qs({ ...params, preview: true })}`).then(setPreview).catch(() => setPreview(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);
  return (
    <Modal open={open} onClose={onClose} title="Envoyer vers Paysapro Prospection">
      <p className="text-[13.5px] text-ink-2">
        Crée un fichier que Prospection reconnaît automatiquement (nom, ville, département, activité, site, Facebook, Instagram).
        Prospection se charge ensuite des coordonnées (SIRENE, e-mail, téléphone).
      </p>
      {ids.length ? (
        <p className="mt-3 text-[13.5px]"><b>{ids.length}</b> prospect(s) sélectionné(s).</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Confiance minimale</Label><Input type="number" min={0} max={100} value={minConf} onChange={(e) => setMinConf(Number(e.target.value))} /></div>
            <div><Label>Potentiel minimal</Label><Input type="number" min={0} max={100} value={minCom} onChange={(e) => setMinCom(Number(e.target.value))} /></div>
          </div>
          <Toggle checked={onlyNew} onChange={setOnlyNew} label="Uniquement ceux jamais envoyés" hint="Évite les doublons dans Prospection" />
        </div>
      )}
      {preview && (
        <p className="mt-3 text-[13px] text-muted">
          {preview.count} entreprise(s) dans le fichier{preview.already_exported ? `, dont ${preview.already_exported} déjà envoyée(s)` : ''}.
          Les données de démonstration et les entreprises « Ne plus contacter » ne sont jamais envoyées.
        </p>
      )}
      <ol className="mt-4 list-decimal pl-5 text-[12.5px] text-ink-2 space-y-1">
        <li>Téléchargez le fichier.</li>
        <li>Dans Prospection, choisissez l'espace <b>Signe &amp; Seine</b>, puis <b>Import → CSV</b>.</li>
        <li>Les colonnes sont reconnues seules ; Prospection signale les doublons éventuels.</li>
      </ol>
      <div className="mt-5 flex gap-2">
        <a href={`/api/export/prospection.csv${query}`} onClick={() => setTimeout(() => { onDone?.(); onClose(); }, 400)}>
          <Button variant="brass" disabled={!preview?.count}><Download className="size-4" />Télécharger le fichier</Button>
        </a>
        <a href={PROSPECTION_IMPORT_URL} target="_blank" rel="noreferrer"><Button><ExternalLink className="size-4" />Ouvrir Prospection</Button></a>
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
      </div>
    </Modal>
  );
}

export const ProspectionIcon = ArrowUpRight;
