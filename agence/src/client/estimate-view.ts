/** Rendu d'une estimation publique (miroir de EstimateView côté serveur). */
export interface Estimate {
  status: 'priced' | 'on_request';
  message: string;
  design: { name: string; priceHt: number | null; fromPrice: boolean } | null;
  printHt: number | null;
  shippingHt: number | null;
  otherHt: number | null;
  totalHt: number | null;
  vatRate: number;
  vatMode: 'normal' | 'franchise';
  vat: number | null;
  totalTtc: number | null;
  leadTimeDays: number | null;
  alternatives: { config: Record<string, string | number>; totalHt: number }[];
}

const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const euros = (c: number | null) => (c == null ? 'Sur devis' : fmt.format(c / 100));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function row(label: string, value: string, note?: string): HTMLElement {
  const d = el('div', 'est-row');
  const dt = el('dt', undefined, label);
  if (note) dt.appendChild(el('small', undefined, note));
  d.append(dt, el('dd', undefined, value));
  return d;
}

/** Construit le DOM sans innerHTML (aucune injection possible). */
export function renderEstimate(target: HTMLElement, est: Estimate, onAlt?: (c: Record<string, string | number>) => void): void {
  const wrap = el('div', `estimate est-${est.status}`);
  const lines = el('dl', 'est-lines');
  if (est.design) lines.appendChild(row('Création graphique', euros(est.design.priceHt), est.design.fromPrice ? 'à partir de' : est.design.name));
  lines.append(row('Impression', euros(est.printHt)), row('Livraison', euros(est.shippingHt)));
  if (est.otherHt) lines.appendChild(row('Autres frais', euros(est.otherHt)));
  const total = el('dl', 'est-total');
  total.append(
    row('Total HT', euros(est.totalHt)),
    row(est.vatMode === 'franchise' ? 'TVA non applicable (art. 293 B du CGI)' : `TVA ${String(est.vatRate).replace('.', ',')} %`, est.vat == null ? '—' : euros(est.vat)),
  );
  const grand = row('Total TTC', euros(est.totalTtc));
  grand.classList.add('est-grand');
  total.appendChild(grand);
  wrap.append(lines, total, el('p', 'est-message', est.message));
  if (est.leadTimeDays) wrap.appendChild(el('p', 'small muted', `Délai de fabrication et livraison indicatif : ${est.leadTimeDays} jours ouvrés après validation du BAT.`));
  if (est.alternatives.length) {
    const alt = el('div', 'alternatives');
    alt.appendChild(el('p', 'small strong', 'Configurations disponibles avec un prix confirmé :'));
    const ul = el('ul');
    for (const a of est.alternatives) {
      const li = el('li');
      const btn = el('a', undefined, `${['format', 'paper', 'weight', 'finish', 'printing', 'extra'].map((k) => a.config[k]).filter(Boolean).join(' · ')} — ${Number(a.config.quantity).toLocaleString('fr-FR')} ex.`);
      btn.href = '#configurateur';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        onAlt?.(a.config);
      });
      li.append(btn, document.createTextNode(` : ${euros(a.totalHt)} HT`));
      ul.appendChild(li);
    }
    alt.appendChild(ul);
    wrap.appendChild(alt);
  }
  target.replaceChildren(wrap);
}

export async function fetchEstimate(product: string, config: Record<string, string | number>, wantDesign: boolean): Promise<Estimate | { error: string }> {
  const res = await fetch('/api/print/estimate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ product, config, wantDesign }),
  });
  const data = await res.json().catch(() => ({ error: 'Réponse invalide.' }));
  if (!res.ok) return { error: (data as { error?: string }).error ?? 'Estimation indisponible.' };
  return (data as { estimate: Estimate }).estimate;
}
