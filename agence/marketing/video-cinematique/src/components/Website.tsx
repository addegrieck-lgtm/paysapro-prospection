import React from 'react';
import { FONTS } from '../config/brand';

// Trois exemples de sites (artisan, services, commerce). Ce sont des modèles génériques « Votre … » :
// aucun faux client, aucun faux avis.
export type SiteExample = {
  name: string;
  kicker: string;
  headline: string;
  cta: string;
  bg: string;
  ink: string;
  accent: string;
  soft: string;
  art: 'bois' | 'eau' | 'fleurs';
  features: string[];
};

export const SITES: SiteExample[] = [
  {
    name: 'VOTRE MENUISERIE',
    kicker: 'Artisan · Pays de Caux',
    headline: 'Menuiserie sur mesure, pensée pour durer.',
    cta: 'Demander un devis',
    bg: '#F5EFE6',
    ink: '#2E2119',
    accent: '#A8693C',
    soft: '#E7D9C6',
    art: 'bois',
    features: ['Cuisines', 'Escaliers', 'Agencement'],
  },
  {
    name: 'VOTRE ENTREPRISE',
    kicker: 'Plomberie · Chauffage',
    headline: 'Un dépannage rapide, un travail soigné.',
    cta: 'Prendre rendez-vous',
    bg: '#F2F6F8',
    ink: '#0F2F38',
    accent: '#1F6F85',
    soft: '#D9E7EC',
    art: 'eau',
    features: ['Dépannage', 'Rénovation', 'Entretien'],
  },
  {
    name: 'VOTRE BOUTIQUE',
    kicker: 'Fleuriste · Centre-ville',
    headline: 'Des fleurs de saison, composées pour vous.',
    cta: 'Voir les créations',
    bg: '#FBF6F1',
    ink: '#3A2A2E',
    accent: '#B4536A',
    soft: '#F1DDE0',
    art: 'fleurs',
    features: ['Bouquets', 'Mariages', 'Livraison'],
  },
];

const Art: React.FC<{ s: SiteExample }> = ({ s }) => {
  if (s.art === 'bois')
    return (
      <svg viewBox="0 0 200 140" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="200" height="140" fill={s.soft} />
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={i * 24 - 6} y={0} width={20} height={140} fill={i % 2 ? '#C79B6E' : '#B6855A'} opacity={0.85} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M${i * 24} 0 q 6 35 0 70 t 0 70`} stroke="#8E5E38" strokeWidth={0.8} fill="none" opacity={0.5} />
        ))}
        <rect x="0" y="96" width="200" height="44" fill="#2E2119" opacity={0.18} />
      </svg>
    );
  if (s.art === 'eau')
    return (
      <svg viewBox="0 0 200 140" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect width="200" height="140" fill="#CFE2E8" />
        {Array.from({ length: 6 }, (_, r) =>
          Array.from({ length: 9 }, (_, c) => (
            <rect key={`${r}-${c}`} x={c * 24 + 2} y={r * 24 + 2} width={21} height={21} fill="#E9F2F5" />
          )),
        )}
        <circle cx="140" cy="62" r="34" fill="#1F6F85" opacity={0.9} />
        <path d="M140 40 q 14 18 0 40 q -14 -22 0 -40z" fill="#E9F2F5" />
      </svg>
    );
  return (
    <svg viewBox="0 0 200 140" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="140" fill={s.soft} />
      {[
        [60, 60, 26, '#B4536A'],
        [100, 48, 30, '#D98A9B'],
        [140, 66, 24, '#E7B7A0'],
        [84, 92, 22, '#9C3F56'],
        [124, 98, 20, '#C9707F'],
      ].map(([x, y, r, c], i) => (
        <g key={i}>
          <circle cx={x as number} cy={y as number} r={r as number} fill={c as string} />
          <circle cx={x as number} cy={y as number} r={(r as number) * 0.35} fill="#FBF6F1" opacity={0.5} />
        </g>
      ))}
      <path d="M100 140 L100 100 M70 140 L84 100 M130 140 L124 104" stroke="#5E7A4E" strokeWidth={3} />
    </svg>
  );
};

/** Page d'accueil d'un site d'exemple, en mise en page ordinateur ou mobile. */
export const WebsitePage: React.FC<{ s: SiteExample; mobile?: boolean; width: number; height: number; scroll?: number }> = ({
  s,
  mobile = false,
  width,
  height,
  scroll = 0,
}) => {
  const u = width / (mobile ? 360 : 1280); // unité : px de maquette
  const pad = (mobile ? 22 : 64) * u;
  return (
    <div style={{ width, height, overflow: 'hidden', background: s.bg, position: 'relative' }}>
      <div style={{ transform: `translateY(${-scroll * height * 0.35}px)` }}>
        {/* barre de navigation */}
        <div
          style={{
            height: (mobile ? 56 : 76) * u,
            padding: `0 ${pad}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `${1 * u}px solid ${s.soft}`,
          }}
        >
          <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: (mobile ? 15 : 19) * u, letterSpacing: '0.18em', color: s.ink }}>
            {s.name}
          </div>
          {mobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 * u }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 20 * u, height: 2 * u, background: s.ink }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 34 * u, alignItems: 'center', fontFamily: FONTS.text, fontSize: 15 * u, color: s.ink }}>
              <span>Services</span>
              <span>Réalisations</span>
              <span>À propos</span>
              <span style={{ background: s.accent, color: '#fff', padding: `${10 * u}px ${18 * u}px`, borderRadius: 999 }}>Contact</span>
            </div>
          )}
        </div>
        {/* héros */}
        <div
          style={{
            display: 'flex',
            flexDirection: mobile ? 'column' : 'row',
            gap: (mobile ? 18 : 48) * u,
            padding: `${(mobile ? 26 : 70) * u}px ${pad}px`,
            alignItems: mobile ? 'stretch' : 'center',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONTS.text, fontSize: (mobile ? 11 : 14) * u, letterSpacing: '0.2em', textTransform: 'uppercase', color: s.accent, fontWeight: 600 }}>
              {s.kicker}
            </div>
            <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: (mobile ? 29 : 58) * u, lineHeight: 1.06, color: s.ink, marginTop: 14 * u }}>
              {s.headline}
            </div>
            <div style={{ marginTop: 18 * u, display: 'flex', flexDirection: 'column', gap: 8 * u }}>
              {[0.92, 0.78].map((w, i) => (
                <div key={i} style={{ height: 9 * u, width: `${w * 100}%`, background: s.ink, opacity: 0.14, borderRadius: 9 * u }} />
              ))}
            </div>
            <div style={{ marginTop: 26 * u, display: 'flex', gap: 12 * u }}>
              <div style={{ background: s.accent, color: '#fff', fontFamily: FONTS.text, fontWeight: 600, fontSize: (mobile ? 13 : 16) * u, padding: `${14 * u}px ${22 * u}px`, borderRadius: 999 }}>
                {s.cta}
              </div>
              {!mobile && (
                <div style={{ border: `${1.5 * u}px solid ${s.ink}`, color: s.ink, fontFamily: FONTS.text, fontSize: 16 * u, padding: `${13 * u}px ${22 * u}px`, borderRadius: 999 }}>
                  Nous appeler
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: mobile ? undefined : 1, height: (mobile ? 190 : 400) * u, borderRadius: 18 * u, overflow: 'hidden' }}>
            <Art s={s} />
          </div>
        </div>
        {/* cartes de services */}
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: 18 * u, padding: `0 ${pad}px` }}>
          {s.features.map((f) => (
            <div key={f} style={{ background: '#fff', borderRadius: 16 * u, padding: 22 * u, boxShadow: `0 ${6 * u}px ${24 * u}px rgba(0,0,0,0.06)` }}>
              <div style={{ width: 34 * u, height: 34 * u, borderRadius: 10 * u, background: s.soft }} />
              <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 20 * u, color: s.ink, marginTop: 14 * u }}>{f}</div>
              <div style={{ height: 8 * u, width: '80%', background: s.ink, opacity: 0.12, borderRadius: 8 * u, marginTop: 12 * u }} />
              <div style={{ height: 8 * u, width: '60%', background: s.ink, opacity: 0.12, borderRadius: 8 * u, marginTop: 8 * u }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
