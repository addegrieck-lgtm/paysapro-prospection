/** Comportements communs du site public (amélioration progressive : tout fonctionne sans JavaScript). */
const html = document.documentElement;
html.classList.add('js');

// En-tête : bordure au défilement.
const header = document.querySelector('.site-header');
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Menus déroulants : fermeture au clic extérieur et avec Échap.
const menus = [...document.querySelectorAll<HTMLDetailsElement>('.nav-menu, .mobile-nav')];
document.addEventListener('click', (e) => {
  for (const m of menus) if (m.open && !m.contains(e.target as Node)) m.open = false;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') for (const m of menus) m.open = false;
});
document.querySelector('.mobile-nav')?.addEventListener('toggle', (e) => {
  document.body.style.overflow = (e.currentTarget as HTMLDetailsElement).open ? 'hidden' : '';
});

// Apparitions discrètes au défilement.
const reveal = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          const el = en.target as HTMLElement;
          const siblings = el.parentElement ? [...el.parentElement.children].filter((x) => x.hasAttribute('data-reveal')) : [];
          el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 5) * 70}ms`;
          el.classList.add('is-visible');
          io.unobserve(el);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const el of reveal) io.observe(el);
} else {
  for (const el of reveal) el.classList.add('is-visible');
}

// ─── Consentement (uniquement si Google Analytics est configuré) ───
const CONSENT = 'consent';
const readConsent = () => document.cookie.split('; ').find((c) => c.startsWith(`${CONSENT}=`))?.split('=')[1];
const writeConsent = (v: 'accept' | 'refuse') => {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT}=${v}; Max-Age=${60 * 60 * 24 * 182}; Path=/; SameSite=Lax${secure}`;
};

function loadGa(id: string) {
  if (!/^G-[A-Z0-9]+$/.test(id)) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  const w = window as unknown as { dataLayer: unknown[]; gtag: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  w.gtag('js', new Date());
  w.gtag('config', id, { anonymize_ip: true });
}

const banner = document.getElementById('consent');
if (banner) {
  const id = banner.dataset.id ?? '';
  const current = readConsent();
  if (current === 'accept') loadGa(id);
  else if (!current) banner.hidden = false;
  banner.addEventListener('click', (e) => {
    const choice = (e.target as HTMLElement).closest<HTMLElement>('[data-consent]')?.dataset.consent;
    if (choice === 'accept' || choice === 'refuse') {
      writeConsent(choice);
      banner.hidden = true;
      if (choice === 'accept') loadGa(id);
    }
  });
}
document.querySelector('[data-consent="reset"]')?.addEventListener('click', () => {
  document.cookie = `${CONSENT}=; Max-Age=0; Path=/`;
  // Les cookies Google déjà déposés sont supprimés pour retirer le consentement.
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0] ?? '';
    if (name.startsWith('_ga')) document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${location.hostname.replace(/^www\./, '.')}`;
  }
  if (banner) banner.hidden = false;
  else location.reload();
});
