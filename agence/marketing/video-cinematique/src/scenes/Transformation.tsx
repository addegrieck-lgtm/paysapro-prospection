import React from 'react';
import { AbsoluteFill } from 'remotion';
import { NightBackground, Particles } from '../components/Atmosphere';
import { Laptop, Phone } from '../components/Devices';
import { easeInOut, easeOut, lerp, prog, sceneOpacity, useScene } from '../components/motion';
import { Title } from '../components/Title';
import { SITES, WebsitePage } from '../components/Website';
import { COLORS, FONTS } from '../config/brand';
import type { SceneProps } from './types';

/** Écran qui enchaîne les trois sites d'exemple : glissement en profondeur + défilement. */
const Screens: React.FC<{ k: number; width: number; height: number; mobile?: boolean }> = ({ k, width, height, mobile }) => {
  const cuts = [0, 0.38, 0.68];
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0A0F11' }}>
      {SITES.map((s, i) => {
        const a = cuts[i];
        const b = cuts[i + 1] ?? 1.2;
        const enter = i === 0 ? prog(k, 0.06, 0.16, easeOut) : prog(k, a, a + 0.07, easeInOut);
        const leave = prog(k, b, b + 0.07, easeInOut);
        if (enter <= 0 || leave >= 1) return null;
        const scroll = prog(k, a + 0.08, b, (x) => x);
        return (
          <div
            key={s.name}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: Math.min(enter, 1 - leave),
              transform: `translateY(${(1 - enter) * 8}%) scale(${lerp(1.04, 1, enter) * lerp(1, 0.94, leave)})`,
            }}
          >
            <WebsitePage s={s} mobile={mobile} width={width} height={height} scroll={scroll} />
          </div>
        );
      })}
    </div>
  );
};

const Chip: React.FC<{ label: string; o: number; style: React.CSSProperties }> = ({ label, o, style }) => (
  <div
    style={{
      position: 'absolute',
      padding: '14px 22px',
      borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))',
      border: '1px solid rgba(255,255,255,0.18)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.2)',
      color: COLORS.white,
      fontFamily: FONTS.text,
      fontSize: 22,
      fontWeight: 500,
      letterSpacing: '0.02em',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      opacity: o,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    <span style={{ width: 9, height: 9, borderRadius: 9, background: COLORS.glow, boxShadow: `0 0 12px ${COLORS.glow}` }} />
    {label}
  </div>
);

/** Scène 2 : studio sombre, ordinateur et smartphone, caméra en orbite. */
export const Transformation: React.FC<SceneProps> = ({ duration, titles }) => {
  const { t, k, width, height, portrait } = useScene(duration);
  const lights = prog(k, 0, 0.14, easeOut);
  const orbit = portrait ? lerp(-12, 10, prog(k, 0, 1, easeInOut)) : lerp(-24, 14, prog(k, 0, 1, easeInOut));
  const tilt = lerp(10, 4, prog(k, 0, 1, easeInOut));
  const dolly = portrait ? lerp(-300, -60, prog(k, 0, 1, easeInOut)) : lerp(-260, 40, prog(k, 0, 1, easeInOut));
  const rise = (1 - prog(k, 0.02, 0.2, easeOut)) * 120;
  const lw = portrait ? width * 0.7 : width * 0.44;
  const pw = portrait ? width * 0.3 : width * 0.12;
  const sw = lw * (1 - 0.036);
  const chips = prog(k, 0.3, 0.42, easeOut) * (1 - prog(k, 0.86, 0.95));
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(k, 0.03, 0.96) }}>
      <NightBackground glow={0.9} beams={0.75 * lights} />
      {/* sol réfléchissant */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: portrait ? height * 0.6 : height * 0.66,
          bottom: 0,
          background: 'radial-gradient(ellipse 60% 70% at 50% 0%, rgba(111,195,211,0.12) 0%, rgba(2,10,13,0) 70%)',
          opacity: lights,
        }}
      />
      <Particles count={70} speed={0.03} opacity={0.5 * lights} seed="t" />
      <AbsoluteFill style={{ perspective: 2400, perspectiveOrigin: '50% 40%' }}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: portrait ? '30%' : '44%',
            transformStyle: 'preserve-3d',
            transform: `translate3d(0, ${rise}px, ${dolly}px) rotateX(${tilt}deg) rotateY(${orbit}deg)`,
            opacity: lights,
          }}
        >
          <div style={{ position: 'absolute', left: -lw / 2, top: -(lw * 0.625) / 2, transformStyle: 'preserve-3d' }}>
            <Laptop width={lw} angle={orbit}>
              <Screens k={k} width={sw} height={sw * 0.625 * 0.97} />
            </Laptop>
          </div>
          <div
            style={{
              position: 'absolute',
              left: portrait ? lw * 0.12 : lw * 0.44,
              top: portrait ? lw * 0.36 : -pw * 0.55,
              transform: `translateZ(${portrait ? 260 : 460}px) rotateY(${-orbit * 0.4 - 8}deg)`,
            }}
          >
            <Phone width={pw} angle={orbit}>
              <Screens k={k} width={pw * 0.886} height={pw * 2.05 * 0.93} mobile />
            </Phone>
          </div>
          {/* éléments d'interface flottants */}
          <div style={{ transformStyle: 'preserve-3d', transform: `translateZ(${portrait ? 340 : 300}px)` }}>
            <Chip label="Pensé mobile" o={chips} style={{ left: portrait ? -lw * 0.52 : -lw * 0.78, top: portrait ? -lw * 0.48 : -lw * 0.28 }} />
            <Chip label="Rapide et sécurisé" o={chips} style={{ left: portrait ? lw * 0.02 : -lw * 0.92, top: portrait ? -lw * 0.62 : lw * 0.02 }} />
            <Chip label="Demande de devis en ligne" o={chips} style={{ left: portrait ? -lw * 0.6 : lw * 0.3, top: portrait ? lw * 0.62 : -lw * 0.48 }} />
          </div>
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: portrait ? '8%' : '7%',
          right: portrait ? '8%' : undefined,
          bottom: portrait ? '10%' : '9%',
        }}
      >
        <Title
          text={titles[0]}
          t={t}
          from={duration * 0.16}
          to={duration * 0.93}
          size={portrait ? width * 0.075 : width * 0.034}
          align={portrait ? 'center' : 'left'}
          maxWidth={portrait ? undefined : width * 0.42}
        />
      </div>
    </AbsoluteFill>
  );
};
