import React from 'react';
import { AbsoluteFill, random, spring } from 'remotion';
import { NightBackground, Particles } from '../components/Atmosphere';
import { CliffMark, Wordmark } from '../components/Logo';
import { easeInOut, easeOut, lerp, prog, sceneOpacity, useScene } from '../components/motion';
import { Title } from '../components/Title';
import { COLORS, FONTS } from '../config/brand';
import type { SceneProps } from './types';

type Rect = [number, number, number, number]; // centre x, centre y, largeur, hauteur (px de référence)

const ELEMENTS = ['logo', 'palette', 'site', 'typo', 'flyer', 'recto', 'verso'] as const;
type El = (typeof ELEMENTS)[number];

const GRID_LANDSCAPE: Record<El, Rect> = {
  logo: [-600, -90, 300, 300],
  palette: [-600, 170, 300, 96],
  site: [-150, -130, 500, 312],
  typo: [-150, 160, 500, 150],
  flyer: [330, 0, 250, 354],
  recto: [640, -110, 300, 194],
  verso: [640, 120, 300, 194],
};

const GRID_PORTRAIT: Record<El, Rect> = {
  logo: [-235, -600, 410, 410],
  recto: [235, -700, 410, 265],
  verso: [235, -420, 410, 265],
  site: [0, -40, 880, 520],
  typo: [-235, 350, 410, 190],
  palette: [-235, 515, 410, 110],
  flyer: [235, 430, 280, 396],
};

const Surface: React.FC<{ bg: string; children?: React.ReactNode; style?: React.CSSProperties }> = ({ bg, children, style }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      borderRadius: 14,
      background: bg,
      overflow: 'hidden',
      boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)',
      ...style,
    }}
  >
    {children}
  </div>
);

const Content: React.FC<{ el: El; w: number; h: number }> = ({ el, w, h }) => {
  const u = w / 300;
  switch (el) {
    case 'logo':
      return (
        <Surface bg={COLORS.seine} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 * u }}>
          <CliffMark width={w * 0.52} fill={COLORS.white} />
          <Wordmark size={17 * u} />
        </Surface>
      );
    case 'palette':
      return (
        <Surface bg="#0B1418" style={{ display: 'flex', padding: 10 * u, gap: 8 * u }}>
          {[COLORS.seine, COLORS.ink, COLORS.paper, COLORS.accent].map((c) => (
            <div key={c} style={{ flex: 1, borderRadius: 8 * u, background: c, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 8 * u, bottom: 6 * u, fontFamily: FONTS.text, fontSize: 9 * u, color: c === COLORS.paper ? COLORS.ink : '#fff', opacity: 0.8 }}>{c}</div>
            </div>
          ))}
        </Surface>
      );
    case 'site':
      return (
        <Surface bg={COLORS.paper}>
          <div style={{ height: 22 * u, background: '#E6DED1', display: 'flex', alignItems: 'center', gap: 5 * u, padding: `0 ${10 * u}px` }}>
            {['#D9897B', '#E4BE6A', '#8FBF8A'].map((c) => (
              <span key={c} style={{ width: 7 * u, height: 7 * u, borderRadius: 7 * u, background: c }} />
            ))}
          </div>
          <div style={{ padding: `${14 * u}px ${18 * u}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 * u }}>
              <CliffMark width={28 * u} fill={COLORS.seine} />
              <Wordmark size={8 * u} color={COLORS.ink} spacing={0.2} />
            </div>
            <div style={{ background: COLORS.accent, color: '#fff', fontFamily: FONTS.text, fontSize: 7 * u, padding: `${5 * u}px ${9 * u}px`, borderRadius: 99 }}>Devis gratuit</div>
          </div>
          <div style={{ padding: `${6 * u}px ${18 * u}px` }}>
            <div style={{ fontFamily: FONTS.text, fontSize: 6.5 * u, letterSpacing: '0.2em', color: COLORS.accent, fontWeight: 600 }}>AGENCE WEB &amp; COMMUNICATION</div>
            <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 21 * u, lineHeight: 1.05, color: COLORS.ink, marginTop: 6 * u, maxWidth: '72%' }}>
              Une image à la hauteur de <span style={{ color: COLORS.accent }}>votre savoir-faire.</span>
            </div>
            <div style={{ marginTop: 10 * u, height: 5 * u, width: '60%', background: COLORS.ink, opacity: 0.15, borderRadius: 5 * u }} />
            <div style={{ marginTop: 5 * u, height: 5 * u, width: '48%', background: COLORS.ink, opacity: 0.15, borderRadius: 5 * u }} />
          </div>
          <svg style={{ position: 'absolute', left: 0, bottom: 10 * u }} width={w} height={14 * u} viewBox="0 0 300 14" preserveAspectRatio="none">
            <path d={`M0 7 q10 -6 20 0 ${'t20 0 '.repeat(14)}`} stroke={COLORS.accent} strokeWidth={1.5} fill="none" />
          </svg>
        </Surface>
      );
    case 'typo':
      return (
        <Surface bg="#0B1418" style={{ display: 'flex', alignItems: 'center', gap: 22 * u, padding: `0 ${22 * u}px` }}>
          <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 66 * u * (h / w > 0.35 ? 1.1 : 1), color: COLORS.white, lineHeight: 1 }}>Aa</div>
          <div style={{ fontFamily: FONTS.text, color: COLORS.silver }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 17 * u, color: COLORS.white }}>Josefin Sans</div>
            <div style={{ fontSize: 13 * u, marginTop: 6 * u, opacity: 0.75 }}>Inter Tight</div>
          </div>
        </Surface>
      );
    case 'flyer':
      return (
        <Surface bg={COLORS.seine} style={{ padding: 20 * u }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 * u }}>
            <CliffMark width={30 * u} fill={COLORS.white} />
            <Wordmark size={7 * u} spacing={0.25} />
          </div>
          <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 26 * u, lineHeight: 1.05, color: '#fff', marginTop: 46 * u }}>Votre activité mérite d’être vue.</div>
          <div style={{ marginTop: 14 * u, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 * u }}>
            {['Sites internet', 'Identité visuelle', 'Impression', 'Vitrophanie'].map((s) => (
              <div key={s} style={{ fontFamily: FONTS.text, fontSize: 8.5 * u, color: '#fff', opacity: 0.85, borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: 5 * u }}>{s}</div>
            ))}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18 * u, height: 2 * u, background: COLORS.accent, opacity: 0.9 }} />
        </Surface>
      );
    case 'recto':
      return (
        <Surface bg={COLORS.seine} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 * u }}>
          <CliffMark width={74 * u} fill={COLORS.white} />
          <Wordmark size={12 * u} />
        </Surface>
      );
    case 'verso':
      return (
        <Surface bg={COLORS.paper} style={{ padding: `${20 * u}px ${22 * u}px` }}>
          <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 16 * u, color: COLORS.seine, letterSpacing: '0.05em' }}>Adrien DEGRIECK</div>
          <div style={{ fontFamily: FONTS.text, fontSize: 8 * u, color: COLORS.seine, opacity: 0.75, marginTop: 4 * u }}>Fondateur · Création web &amp; graphique</div>
          <div style={{ marginTop: 18 * u, display: 'flex', flexDirection: 'column', gap: 6 * u, fontFamily: FONTS.text, fontSize: 8.5 * u, color: COLORS.seine }}>
            <span>06 47 41 42 24</span>
            <span>contact@signeetseine.fr</span>
            <span>signeetseine.fr</span>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 10 * u, height: 1.5 * u, background: COLORS.accent, opacity: 0.85 }} />
        </Surface>
      );
  }
};

/** Scène 4 : les éléments de la marque flottent dans l'espace puis se rangent en planche cohérente. */
export const Identite: React.FC<SceneProps> = ({ duration, titles }) => {
  const { t, k, frame, fps, width, height, portrait } = useScene(duration);
  const grid = portrait ? GRID_PORTRAIT : GRID_LANDSCAPE;
  const s = portrait ? width / 1080 : width / 1920;
  const snapAt = duration * 0.4;
  const sweep = prog(k, 0, 0.14, easeInOut);
  const camY = lerp(-14, 9, prog(k, 0, 1, easeInOut));
  const camX = lerp(10, 3, prog(k, 0, 1, easeInOut));
  const two = titles.length > 1 && titles[1];
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(k, 0.02, 0.96) }}>
      <NightBackground glow={1} beams={0.5} tint="#0A2B35" />
      <Particles count={80} speed={0.04} opacity={0.55} seed="i" />
      <AbsoluteFill style={{ perspective: 2000 }}>
        <div
          style={{
            position: 'absolute',
            left: width / 2,
            top: portrait ? height * 0.46 : height * 0.45,
            transformStyle: 'preserve-3d',
            transform: `scale(${s}) rotateX(${camX}deg) rotateY(${camY}deg)`,
          }}
        >
          {ELEMENTS.map((el, i) => {
            const [gx, gy, w, h] = grid[el];
            const r = (n: string) => random(`${el}${n}`) - 0.5;
            const drift = t * 0.6;
            const from = {
              x: r('x') * (portrait ? 900 : 1700) + Math.sin(drift + i) * 30,
              y: r('y') * (portrait ? 1500 : 800) + Math.cos(drift * 0.8 + i) * 24,
              z: -500 + r('z') * 900,
              rx: r('a') * 70,
              ry: r('b') * 80,
              rz: r('c') * 40,
            };
            const snap = spring({ frame: frame - Math.round((snapAt + i * duration * 0.018) * fps), fps, config: { damping: 15, mass: 0.9, stiffness: 90 } });
            const enter = prog(t, i * duration * 0.025, duration * 0.12 + i * duration * 0.025, easeOut);
            const x = lerp(from.x, gx, snap);
            const y = lerp(from.y, gy, snap);
            const z = lerp(from.z, 0, snap) - (1 - enter) * 900;
            return (
              <div
                key={el}
                style={{
                  position: 'absolute',
                  left: -w / 2,
                  top: -h / 2,
                  width: w,
                  height: h,
                  opacity: enter,
                  transform: `translate3d(${x}px, ${y}px, ${z}px) rotateX(${lerp(from.rx, 0, snap)}deg) rotateY(${lerp(from.ry, 0, snap)}deg) rotateZ(${lerp(from.rz, 0, snap)}deg)`,
                }}
              >
                <Content el={el} w={w} h={h} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      {/* balayage lumineux d'entrée */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: lerp(-0.3, 1.1, sweep) * width,
          width: width * 0.22,
          background: 'linear-gradient(90deg, rgba(111,195,211,0) 0%, rgba(200,240,248,0.55) 50%, rgba(111,195,211,0) 100%)',
          opacity: 1 - prog(k, 0.1, 0.16),
          mixBlendMode: 'screen',
        }}
      />
      <div style={{ position: 'absolute', left: '6%', right: '6%', bottom: portrait ? '5%' : '7%', display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Title text={titles[0]} t={t} from={duration * 0.1} to={two ? duration * 0.5 : duration * 0.94} size={portrait ? width * 0.07 : width * 0.031} />
          {two && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}>
              <Title text={titles[1]} t={t} from={duration * 0.52} to={duration * 0.94} size={portrait ? width * 0.07 : width * 0.031} />
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
