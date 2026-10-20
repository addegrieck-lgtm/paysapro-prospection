/** Petites aides de l'administration. */
// Confirmation avant les actions irréversibles.
document.addEventListener('submit', (e) => {
  const f = e.target as HTMLFormElement;
  const msg = f.dataset.confirm;
  if (msg && !confirm(msg)) e.preventDefault();
});
// Calcul en direct du TTC et des marges dans les formulaires de prix.
const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const cents = (v: string) => {
  const s = v.replace(/[€\s ]/g, '').replace(',', '.');
  return /^-?\d+(\.\d{1,2})?$/.test(s) ? Math.round(Number(s) * 100) : null;
};
for (const box of document.querySelectorAll<HTMLElement>('[data-live-margin]')) {
  const form = box.closest('form');
  const hourly = Number(box.dataset.hourly ?? '0');
  const update = () => {
    if (!form) return;
    const g = (n: string) => cents((form.querySelector<HTMLInputElement>(`[name="${n}"]`)?.value ?? '') || '0') ?? 0;
    const price = cents(form.querySelector<HTMLInputElement>('[name="price_ht"]')?.value ?? '');
    const hours = Number((form.querySelector<HTMLInputElement>('[name="work_hours"]')?.value ?? '0').replace(',', '.')) || 0;
    const costs = g('cost_production') + g('cost_supplier') + g('cost_shipping') + g('cost_external') + Math.round(hours * hourly);
    if (price == null) {
      box.textContent = 'Prix sur devis : marge non calculable.';
      return;
    }
    const margin = price - costs;
    const rate = costs > 0 ? `${((margin / costs) * 100).toFixed(1).replace('.', ',')} %` : '—';
    const mark = price > 0 ? `${((margin / price) * 100).toFixed(1).replace('.', ',')} %` : '—';
    box.textContent = `Coûts directs : ${fmt.format(costs / 100)} · Marge brute : ${fmt.format(margin / 100)} · Taux de marge : ${rate} · Taux de marque : ${mark}`;
  };
  form?.addEventListener('input', update);
  update();
}
// Copie d'un lien client.
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(b.dataset.copy ?? '');
      const old = b.textContent;
      b.textContent = 'Copié ✓';
      setTimeout(() => (b.textContent = old), 1500);
    } catch {
      prompt('Copiez le lien :', b.dataset.copy ?? '');
    }
  });
}
// Impression des documents.
document.querySelector('[data-print]')?.addEventListener('click', () => window.print());
