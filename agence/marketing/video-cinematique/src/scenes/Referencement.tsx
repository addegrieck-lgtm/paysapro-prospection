import React from 'react';
import { AbsoluteFill } from 'remotion';
import { NightBackground, Particles } from '../components/Atmosphere';
import { easeInOut, easeOut, lerp, prog, sceneOpacity, useScene } from '../components/motion';
import { Title } from '../components/Title';
import { COLORS, FONTS } from '../config/brand';
import type { SceneProps } from './types';

// Visualisation pédagogique du SEO : aucun classement, aucun chiffre, aucune promesse de résultat.
const KEYWORDS = ['menuisier Bolbec', 'plombier Le Havre', 'fleuriste Fécamp', 'création site internet'];
const PAGES = ['Services', 'Réalisations', 'Contact'];
const CHECKS = ['Structure et balises', 'Vitesse de chargement', 'Version mobile', 'Fiche Google', 'Données structurées'];

type P = { x: number; y: number };
type Layout = {
  w: number;
  h: number;
  chips: (P & { w: number })[];
  root: P;
  pages: P[];
  panel: P & { w: number; h: number };
};

const LANDSCAPE: Layout = {
  w: 1560,
  h: 760,
  chips: [0, 1, 2, 3].map((i) => ({ x: 20, y: 150 + i * 135, w: 330 })),
  root: { x: 760, y: 190 },
  pages: [0, 1, 2].map((i) => ({ x: 580 + i * 180, y: 470 })),
  panel: { x: 1110, y: 90, w: 430, h: 600 },
};

const PORTRAIT: Layout = {
  w: 940,
  h: 1380,
  chips: [0, 1, 2, 3].map((i) => ({ x: i % 2 ? 490 : 30, y: 30 + Math.floor(i / 2) * 105, w: 420 })),
  root: { x: 470, y: 420 },
  pages: [0, 1, 2].map((i) => ({ x: 170 + i * 300, y: 650 })),
  panel: { x: 80, y: 820, w: 780, h: 540 },
};

const bez = (a: P, b: P, c1: P, c2: P, s: number): P => {
  const u = 1 - s;
  return {
    x: u * u * u * a.x + 3 * u * u * s * c1.x + 3 * u * s * s * c2.x + s * s * s * b.x,
    y: u * u * u * a.y + 3 * u * u * s * c1.y + 3 * u * s * s * c2.y + s * s * s * b.y,
  };
};

const Glass: React.FC<{ style: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      position: 'absolute',
      borderRadius: 18,
      background: 'linear-gradient(140deg, rgba(255,255,255,0.13), rgba(255,255,255,0.03))',
      border: '1px solid rgba(255,255,255,0.16)',
      boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)',
      color: COLORS.white,
      fontFamily: FONTS.text,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Scène 3 : mots-clés, pages et indicateurs se connectent par des lignes de lumière. */
export const Referencement: React.FC<SceneProps> = ({ duration, titles }) => {
  const { t, k, width, height, portrait } = useScene(duration);
  const L = portrait ? PORTRAIT : LANDSCAPE;
  const scale = portrait ? (width * 0.94) / L.w : (width * 0.86) / L.w;
  const rx = lerp(26, 12, prog(k, 0, 1, easeInOut));
  const ry = portrait ? 0 : lerp(-9, 7, prog(k, 0, 1, easeInOut));
  const tz = lerp(-240, 30, prog(k, 0, 1, easeInOut));

  const rootIn = prog(k, 0.07, 0.17, easeOut);
  const pageIn = (i: number) => prog(k, 0.15 + i * 0.03, 0.25 + i * 0.03, easeOut);
  const chipIn = (i: number) => prog(k, 0.24 + i * 0.04, 0.34 + i * 0.04, easeOut);
  const panelIn = prog(k, 0.4, 0.52, easeOut);
  const chart = prog(k, 0.48, 0.8, easeInOut);

  const nodeW = portrait ? 230 : 160;
  const rootW = portrait ? 330 : 260;
  const links: { a: P; b: P; draw: number; seed: number }[] = [];
  L.pages.forEach((p, i) =>
    links.push({ a: { x: L.root.x, y: L.root.y + 44 }, b: { x: p.x, y: p.y - 36 }, draw: prog(k, 0.15 + i * 0.03, 0.3 + i * 0.03), seed: i }),
  );
  L.chips.forEach((c, i) => {
    const target = L.pages[i % 3];
    const a = portrait ? { x: c.x + c.w / 2, y: c.y + 70 } : { x: c.x + c.w, y: c.y + 32 };
    links.push({ a, b: portrait ? { x: target.x, y: target.y - 36 } : { x: target.x - nodeW / 2, y: target.y }, draw: prog(k, 0.32 + i * 0.04, 0.5 + i * 0.04), seed: 10 + i });
  });
  const ctrl = (a: P, b: P): [P, P] =>
    portrait ? [{ x: a.x, y: lerp(a.y, b.y, 0.6) }, { x: b.x, y: lerp(a.y, b.y, 0.4) }] : [{ x: lerp(a.x, b.x, 0.55), y: a.y }, { x: lerp(a.x, b.x, 0.45), y: b.y }];

  // Courbe de « visibilité » sans axe chiffré.
  const cw = L.panel.w - 70;
  const ch = portrait ? 170 : 200;
  const pts = Array.from({ length: 40 }, (_, i) => {
    const s = i / 39;
    const y = 0.88 - 0.62 * Math.pow(s, 1.35) - 0.05 * Math.sin(s * 11) * (1 - s * 0.5);
    return { x: s * cw, y: y * ch };
  });
  const visible = pts.slice(0, Math.max(2, Math.round(chart * pts.length)));
  const line = visible.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${visible[visible.length - 1].x} ${ch} L0 ${ch} Z`;

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(k, 0.03, 0.96) }}>
      <NightBackground glow={0.85} beams={0.35} tint="#071F27" />
      {/* sol en grille lumineuse */}
      <AbsoluteFill style={{ perspective: 900, opacity: prog(k, 0, 0.12) * 0.7 }}>
        <div
          style={{
            position: 'absolute',
            left: '-50%',
            width: '200%',
            top: '58%',
            height: '120%',
            transformOrigin: '50% 0%',
            transform: 'rotateX(78deg)',
            backgroundImage:
              'linear-gradient(rgba(111,195,211,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(111,195,211,0.22) 1px, transparent 1px)',
            backgroundSize: '90px 90px',
            backgroundPosition: `0 ${t * 40}px`,
            WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0) 60%)',
          }}
        />
      </AbsoluteFill>
      <Particles count={90} speed={0.05} opacity={0.6} seed="r" />
      <AbsoluteFill style={{ perspective: 2200 }}>
        <div
          style={{
            position: 'absolute',
            left: (width - L.w * scale) / 2,
            top: portrait ? height * 0.1 : height * 0.2,
            width: L.w,
            height: L.h,
            transformOrigin: '0 0',
            transform: `scale(${scale})`,
          }}
        >
          <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transformOrigin: '50% 60%', transform: `translateZ(${tz}px) rotateX(${rx}deg) rotateY(${ry}deg)` }}>
            <svg width={L.w} height={L.h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
              <defs>
                <filter id="lueur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {links.map(({ a, b, draw, seed }, i) => {
                const [c1, c2] = ctrl(a, b);
                const d = `M${a.x} ${a.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`;
                const pulse = ((t * 0.55 + seed * 0.37) % 1 + 1) % 1;
                const pp = bez(a, b, c1, c2, pulse);
                return (
                  <g key={i} filter="url(#lueur)">
                    <path d={d} stroke={COLORS.glow} strokeWidth={2} fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} opacity={0.75} />
                    {draw >= 1 && <circle cx={pp.x} cy={pp.y} r={5} fill="#EFFAFC" opacity={Math.sin(pulse * Math.PI)} />}
                  </g>
                );
              })}
            </svg>
            {/* page d'accueil */}
            <Glass style={{ left: L.root.x - rootW / 2, top: L.root.y - 44, width: rootW, height: 88, opacity: rootIn, transform: `translateZ(${(1 - rootIn) * -200}px)`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 22px' }}>
              <div style={{ width: 44, height: 34, borderRadius: 6, border: `2px solid ${COLORS.glow}`, position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: 7, borderTop: `2px solid ${COLORS.glow}` }} />
              </div>
              <div>
                <div style={{ fontSize: 15, letterSpacing: '0.2em', color: COLORS.glow, fontWeight: 600 }}>VOTRE-SITE.FR</div>
                <div style={{ fontSize: 26, fontWeight: 600, marginTop: 2 }}>Accueil</div>
              </div>
            </Glass>
            {L.pages.map((p, i) => (
              <Glass key={i} style={{ left: p.x - nodeW / 2, top: p.y - 36, width: nodeW, height: 72, opacity: pageIn(i), transform: `translateZ(${(1 - pageIn(i)) * -160}px)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: portrait ? 26 : 22, fontWeight: 500 }}>
                {PAGES[i]}
              </Glass>
            ))}
            {L.chips.map((c, i) => (
              <Glass
                key={i}
                style={{ left: c.x, top: c.y, width: c.w, height: 64, borderRadius: 999, opacity: chipIn(i), transform: `translateX(${(1 - chipIn(i)) * -60}px) translateZ(60px)`, display: 'flex', alignItems: 'center', gap: 14, padding: '0 26px', fontSize: portrait ? 26 : 23 }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.glow} strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="M15.5 15.5L21 21" />
                </svg>
                {KEYWORDS[i]}
              </Glass>
            ))}
            {/* panneau d'indicateurs */}
            <Glass style={{ left: L.panel.x, top: L.panel.y, width: L.panel.w, height: L.panel.h, opacity: panelIn, transform: `translateZ(${40 + (1 - panelIn) * -200}px)`, padding: 34 }}>
              <div style={{ fontSize: 15, letterSpacing: '0.24em', color: COLORS.glow, fontWeight: 600 }}>VISIBILITÉ EN LIGNE</div>
              <svg width={cw} height={ch} style={{ marginTop: 22, overflow: 'visible' }}>
                <defs>
                  <linearGradient id="aire" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={COLORS.glow} stopOpacity="0.35" />
                    <stop offset="1" stopColor={COLORS.glow} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75].map((g) => (
                  <line key={g} x1={0} x2={cw} y1={g * ch} y2={g * ch} stroke="rgba(255,255,255,0.08)" />
                ))}
                <path d={area} fill="url(#aire)" />
                <path d={line} stroke={COLORS.glow} strokeWidth={3} fill="none" filter="url(#lueur)" />
                <circle cx={visible[visible.length - 1].x} cy={visible[visible.length - 1].y} r={6} fill="#EFFAFC" opacity={chart > 0.02 ? 1 : 0} />
              </svg>
              <div style={{ marginTop: 26, display: 'grid', gridTemplateColumns: portrait ? '1fr 1fr' : '1fr', gap: portrait ? '14px 24px' : 14 }}>
                {CHECKS.map((c, i) => {
                  const ok = prog(k, 0.55 + i * 0.045, 0.62 + i * 0.045, easeOut);
                  return (
                    <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: portrait ? 24 : 21, opacity: 0.35 + 0.65 * ok }}>
                      <div style={{ width: 26, height: 26, borderRadius: 26, border: `2px solid ${COLORS.glow}`, display: 'grid', placeItems: 'center', background: `rgba(111,195,211,${0.25 * ok})`, boxShadow: `0 0 ${16 * ok}px ${COLORS.glowSoft}` }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" style={{ opacity: ok }}>
                          <path d="M4 12.5l5 5L20 6.5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      {c}
                    </div>
                  );
                })}
              </div>
            </Glass>
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: '6%', right: '6%', top: portrait ? undefined : '7%', bottom: portrait ? '6%' : undefined, display: 'flex', justifyContent: 'center' }}>
        <Title text={titles[0]} t={t} from={duration * 0.12} to={duration * 0.93} size={portrait ? width * 0.07 : width * 0.031} maxWidth={portrait ? width * 0.86 : undefined} />
      </div>
    </AbsoluteFill>
  );
};
