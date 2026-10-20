import { fetchEstimate, renderEstimate } from './estimate-view';

/** Configurateur d'impression : estimation en direct à chaque changement. */
const root = document.querySelector<HTMLElement>('[data-configurator]');
if (root) {
  const form = root.querySelector<HTMLFormElement>('form')!;
  const target = root.querySelector<HTMLElement>('[data-estimate]')!;
  const quoteLink = root.querySelector<HTMLAnchorElement>('[data-quote-link]');
  const product = root.dataset.product!;
  let seq = 0;

  const readConfig = () => {
    const fd = new FormData(form);
    const config: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (typeof v === 'string' && k !== 'creation') config[k] = v;
    return { config, wantDesign: fd.get('creation') === '1' };
  };

  const update = async () => {
    const { config, wantDesign } = readConfig();
    const params = new URLSearchParams({ type: 'impression', produit: product, ...config, ...(wantDesign ? { creation: '1' } : {}) });
    if (quoteLink) quoteLink.href = `/devis?${params.toString()}`;
    history.replaceState(null, '', `?${new URLSearchParams({ ...config, ...(wantDesign ? { creation: '1' } : {}) }).toString()}#configurateur`);
    const id = ++seq;
    root.classList.add('is-loading');
    try {
      const est = await fetchEstimate(product, config, wantDesign);
      if (id !== seq) return;
      if ('error' in est) {
        const p = document.createElement('p');
        p.className = 'est-message';
        p.textContent = est.error;
        target.replaceChildren(p);
      } else renderEstimate(target, est, applyConfig);
    } catch {
      const p = document.createElement('p');
      p.className = 'est-message';
      p.textContent = 'Estimation momentanément indisponible. Vous pouvez tout de même demander votre devis.';
      target.replaceChildren(p);
    } finally {
      if (id === seq) root.classList.remove('is-loading');
    }
  };

  function applyConfig(c: Record<string, string | number>) {
    for (const [k, v] of Object.entries(c)) {
      const radio = form.querySelector<HTMLInputElement>(`input[type=radio][name="${CSS.escape(k)}"][value="${CSS.escape(String(v))}"]`);
      if (radio) radio.checked = true;
      const select = form.querySelector<HTMLSelectElement>(`select[name="${CSS.escape(k)}"]`);
      if (select) select.value = String(v);
    }
    void update();
  }

  form.addEventListener('change', () => void update());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void update();
  });
}
