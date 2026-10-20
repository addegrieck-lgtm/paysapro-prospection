import { fetchEstimate, renderEstimate } from './estimate-view';

/**
 * Assistant de devis en 6 étapes. Sans JavaScript, toutes les étapes s'affichent à la suite
 * et le formulaire reste entièrement utilisable (validation finale côté serveur).
 */
const form = document.querySelector<HTMLFormElement>('[data-wizard]');
if (form) {
  form.noValidate = true; // validation gérée étape par étape ci-dessous
  const steps = [...form.querySelectorAll<HTMLFieldSetElement>('.step')];
  const dots = [...form.querySelectorAll<HTMLElement>('[data-step-dot]')];
  const prev = form.querySelector<HTMLButtonElement>('[data-prev]')!;
  const next = form.querySelector<HTMLButtonElement>('[data-next]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const data = JSON.parse(document.getElementById('quote-data')?.textContent ?? '{"products":[]}') as { products: { slug: string; name: string }[] };
  const MAX_FILES = 5;
  const MAX_SIZE = 10 * 1024 * 1024;
  const OK_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
  let current = 0;

  const type = () => form.querySelector<HTMLInputElement>('input[name="type"]:checked')?.value ?? '';

  function syncConditionals() {
    const t = type();
    for (const block of form!.querySelectorAll<HTMLElement>('[data-show-for]')) {
      const show = (block.dataset.showFor ?? '').split(' ').includes(t);
      block.hidden = !show;
      for (const input of block.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')) {
        if (!input.closest('[data-product-options]')) input.disabled = !show;
      }
    }
    syncProduct();
    syncServiceOptions();
  }

  function syncProduct() {
    const sel = form!.querySelector<HTMLSelectElement>('[data-product-select]');
    const slug = sel && !sel.disabled ? sel.value : '';
    for (const box of form!.querySelectorAll<HTMLElement>('[data-product-options]')) {
      const active = box.dataset.productOptions === slug;
      box.hidden = !active;
      for (const fs of box.querySelectorAll('fieldset')) fs.disabled = !active;
    }
    void updateEstimate();
  }

  function syncServiceOptions() {
    const service = form!.querySelector<HTMLSelectElement>('select[name="service"]')?.value ?? '';
    const groups = [...form!.querySelectorAll<HTMLElement>('[data-service-options]')];
    for (const g of groups) {
      const show = service ? g.dataset.serviceOptions === service : false;
      g.hidden = !show;
      for (const i of g.querySelectorAll('input')) i.disabled = !show;
    }
  }

  let seq = 0;
  async function updateEstimate() {
    const box = form!.querySelector<HTMLElement>('[data-wizard-estimate]');
    const sel = form!.querySelector<HTMLSelectElement>('[data-product-select]');
    if (!box || !sel || sel.disabled || !sel.value || type() !== 'impression') {
      if (box) box.hidden = true;
      return;
    }
    const opts = form!.querySelector<HTMLElement>(`[data-product-options="${CSS.escape(sel.value)}"] fieldset`);
    if (!opts) {
      box.hidden = true;
      return;
    }
    const config: Record<string, string> = {};
    for (const i of opts.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input:checked, select')) config[i.name.replace(/^print_/, '')] = i.value;
    const id = ++seq;
    try {
      const est = await fetchEstimate(sel.value, config, form!.querySelector<HTMLInputElement>('input[name="want_design"]')?.checked ?? false);
      if (id !== seq) return;
      box.hidden = false;
      const target = box.querySelector<HTMLElement>('[data-estimate]')!;
      if ('error' in est) target.textContent = est.error;
      else renderEstimate(target, est);
    } catch {
      box.hidden = true;
    }
  }

  function fieldsOf(step: HTMLElement) {
    return [...step.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')].filter((f) => !f.disabled && f.type !== 'hidden');
  }

  function validateStep(i: number): boolean {
    const step = steps[i]!;
    for (const f of fieldsOf(step)) {
      if (!f.checkValidity()) {
        f.reportValidity();
        return false;
      }
    }
    if (i === 3) return checkFiles();
    return true;
  }

  function show(i: number) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, k) => s.classList.toggle('is-active', k === current));
    dots.forEach((d, k) => {
      d.classList.toggle('is-current', k === current);
      d.classList.toggle('is-done', k < current);
    });
    prev.hidden = current === 0;
    next.hidden = current === steps.length - 1;
    submit.hidden = current !== steps.length - 1;
    if (current === steps.length - 1) buildRecap();
    const legend = steps[current]!.querySelector('legend');
    if (legend) {
      legend.setAttribute('tabindex', '-1');
      legend.focus({ preventScroll: true });
    }
    form!.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ─── Fichiers ───
  const fileInput = form.querySelector<HTMLInputElement>('[data-files]');
  const fileList = form.querySelector<HTMLElement>('[data-file-list]');
  const dropzone = form.querySelector<HTMLElement>('.dropzone');
  function checkFiles(): boolean {
    if (!fileInput || !fileList) return true;
    const files = [...(fileInput.files ?? [])];
    fileList.replaceChildren();
    let ok = files.length <= MAX_FILES;
    for (const f of files) {
      const li = document.createElement('li');
      const problem = !OK_TYPES.includes(f.type) ? 'format non accepté' : f.size > MAX_SIZE ? 'fichier trop lourd (10 Mo max.)' : '';
      if (problem) {
        ok = false;
        li.className = 'is-error';
      }
      const name = document.createElement('span');
      name.textContent = f.name;
      const info = document.createElement('span');
      info.textContent = problem || `${(f.size / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
      li.append(name, info);
      fileList.appendChild(li);
    }
    if (files.length > MAX_FILES) {
      const li = document.createElement('li');
      li.className = 'is-error';
      li.textContent = `${MAX_FILES} fichiers maximum.`;
      fileList.appendChild(li);
    }
    fileInput.setCustomValidity(ok ? '' : 'Vérifiez les fichiers sélectionnés.');
    return ok;
  }
  fileInput?.addEventListener('change', checkFiles);
  if (dropzone && fileInput) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('is-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-over'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-over');
      if (e.dataTransfer?.files.length) {
        fileInput.files = e.dataTransfer.files;
        checkFiles();
      }
    });
  }

  // ─── Récapitulatif ───
  function label(f: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
    const fs = f.closest('fieldset.chips-field, .field');
    const l = fs?.querySelector('legend, label');
    if (f.type === 'radio' || f.type === 'checkbox') {
      const own = f.closest('label')?.textContent?.trim();
      return (l && !l.contains(f) ? l.textContent?.trim() : '') + (own ? `||${own}` : '');
    }
    return l?.textContent?.replace('*', '').trim() ?? f.name;
  }

  function buildRecap() {
    const target = form!.querySelector<HTMLElement>('[data-recap]')!;
    const dl = document.createElement('dl');
    const add = (k: string, v: string) => {
      if (!v.trim()) return;
      const d = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      d.append(dt, dd);
      dl.appendChild(d);
    };
    const groups = new Map<string, string[]>();
    for (const step of steps.slice(0, 5)) {
      for (const f of fieldsOf(step)) {
        if (f.name === 'website_url' || f.type === 'file') continue;
        if ((f.type === 'radio' || f.type === 'checkbox') && !(f as HTMLInputElement).checked) continue;
        let key: string;
        let val: string;
        if (f.type === 'radio' || f.type === 'checkbox') {
          const [k, own] = label(f).split('||');
          key = k || f.name;
          val = own ?? f.value;
        } else if (f instanceof HTMLSelectElement) {
          key = label(f);
          val = f.value ? f.selectedOptions[0]?.textContent ?? f.value : '';
        } else {
          key = label(f);
          val = f.value;
        }
        if (!val) continue;
        groups.set(key, [...(groups.get(key) ?? []), val]);
      }
    }
    for (const [k, v] of groups) add(k, v.join(', '));
    const files = [...(fileInput?.files ?? [])].map((f) => f.name);
    if (files.length) add('Fichiers joints', files.join('\n'));
    const intro = document.createElement('p');
    intro.className = 'muted';
    intro.textContent = 'Vérifiez vos informations. Vous pouvez revenir en arrière pour les modifier.';
    target.replaceChildren(intro, dl);
  }

  // ─── Navigation ───
  next.addEventListener('click', () => {
    if (validateStep(current)) show(current + 1);
  });
  prev.addEventListener('click', () => show(current - 1));
  form.addEventListener('submit', (e) => {
    for (let i = 0; i < steps.length; i++) {
      if (!validateStep(i)) {
        e.preventDefault();
        show(i);
        validateStep(i);
        return;
      }
    }
    submit.disabled = true;
    submit.textContent = 'Envoi en cours…';
  });
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    if (t.matches('input[name="type"]')) syncConditionals();
    else if (t.matches('[data-product-select]')) syncProduct();
    else if (t.matches('select[name="service"]')) syncServiceOptions();
    else if (t.closest('[data-product-options]') || t.matches('input[name="want_design"]')) void updateEstimate();
  });
  // Choisir une offre précise sélectionne le type correspondant si aucun n'est choisi.
  void data;

  syncConditionals();
  const firstError = document.querySelector('.notice-error');
  show(0);
  if (firstError) firstError.scrollIntoView({ block: 'center' });
}
