import React from 'react';
import { AbsoluteFill } from 'remotion';
import { NightBackground, Particles } from '../components/Atmosphere';
import { CliffMark, Wordmark } from '../components/Logo';
import { easeInOut, easeOut, lerp, prog, sceneOpacity, useScene } from '../components/motion';
import { Qr } from '../components/Qr';
import { Title } from '../components/Title';
import { BRAND, COLORS, FONTS } from '../config/brand';
import type { SceneProps } from './types';

/** Scène 5 : tout converge vers le logo, puis appel à l'action et adresse du site. */
export const Signature: React.FC<SceneProps> = ({ duration, titles }) => {
  const { t, k, width, height, portrait } = useScene(duration);
  const tagline = titles[0];
  const short = !tagline;
  // Bascule vers le plan final (appel à l'action).
  const p2 = short ? 0.42 : 0.64;
  const toEnd = prog(k, p2, p2 + 0.1, easeInOut);

  const attract = prog(k, 0, short ? 0.3 : 0.35, easeInOut);
  const bloom = prog(k, 0.08, short ? 0.3 : 0.4, easeOut);
  const reveal = prog(k, short ? 0.05 : 0.12, short ? 0.25 : 0.34, easeInOut);
  const pull = lerp(1.22, 1, prog(k, 0, short ? 0.45 : 0.62, easeOut));
  const words = prog(k, short ? 0.16 : 0.28, short ? 0.3 : 0.4, easeOut);
  const base = prog(k, short ? 0.22 : 0.36, short ? 0.36 : 0.46, easeOut) * (1 - toEnd);
  const cta = prog(k, p2 + 0.03, p2 + 0.13, easeOut);
  const url = prog(k, p2 + 0.08, p2 + 0.18, easeOut);
  const qr = prog(k, p2 + 0.12, p2 + 0.22, easeOut);

  const logoW = portrait ? width * 0.42 : width * 0.17;
  const logoY = lerp(portrait ? height * 0.3 : height * 0.33, portrait ? height * 0.22 : height * 0.2, toEnd);
  const logoScale = lerp(1, portrait ? 0.75 : 0.72, toEnd);
  const wordY = lerp(portrait ? height * 0.43 : height * 0.53, portrait ? height * 0.33 : height * 0.36, toEnd);
  const wordSize = lerp(portrait ? width * 0.068 : width * 0.036, portrait ? width * 0.056 : width * 0.026, toEnd);
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(k, 0.03, 2) }}>
      <NightBackground glow={0.5 + 0.5 * bloom} beams={0.5 * bloom} />
      <Particles count={portrait ? 160 : 200} speed={0.06} attract={attract} opacity={1 - prog(k, 0.3, 0.5) * 0.7} seed="s" />
      {/* lumière qui révèle le logo */}
      <div
        style={{
          position: 'absolute',
          left: width / 2 - width * 0.6,
          top: logoY - width * 0.35,
          width: width * 1.2,
          height: width * 0.7,
          background: 'radial-gradient(ellipse at center, rgba(160,220,232,0.30) 0%, rgba(111,195,211,0.10) 30%, rgba(111,195,211,0) 62%)',
          opacity: bloom,
          transform: `scale(${pull})`,
        }}
      />
      <AbsoluteFill style={{ transform: `scale(${pull})` }}>
        <div
          style={{
            position: 'absolute',
            left: width / 2 - logoW / 2,
            top: logoY - (logoW * 44) / 64 / 2,
            transform: `scale(${logoScale})`,
            opacity: reveal,
            filter: `blur(${(1 - reveal) * 14}px) drop-shadow(0 0 40px rgba(111,195,211,${0.45 * bloom}))`,
          }}
        >
          <CliffMark width={logoW} wave={prog(k, short ? 0.12 : 0.22, short ? 0.32 : 0.42, easeOut)} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: wordY, display: 'flex', justifyContent: 'center', opacity: words }}>
          <Wordmark size={wordSize} spacing={lerp(0.6, 0.32, words)} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: wordY + wordSize * 1.9,
            textAlign: 'center',
            fontFamily: FONTS.text,
            fontSize: portrait ? width * 0.036 : width * 0.0135,
            letterSpacing: '0.28em',
            color: COLORS.silver,
            textTransform: 'uppercase',
            opacity: base,
          }}
        >
          {BRAND.baseline}
        </div>
      </AbsoluteFill>
      {tagline && (
        <div style={{ position: 'absolute', left: '7%', right: '7%', top: portrait ? height * 0.6 : height * 0.74, display: 'flex', justifyContent: 'center' }}>
          <Title text={tagline} t={t} from={duration * 0.44} to={duration * (p2 + 0.04)} size={portrait ? width * 0.064 : width * 0.03} weight={300} maxWidth={portrait ? width * 0.86 : undefined} />
        </div>
      )}
      {/* plan final */}
      <div style={{ position: 'absolute', left: '6%', right: '6%', top: portrait ? height * 0.47 : height * 0.5, display: 'flex', justifyContent: 'center' }}>
        <Title text={titles[1]} t={t} from={duration * (p2 + 0.03)} to={duration * 3} size={portrait ? width * 0.085 : width * 0.046} weight={600} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: portrait ? height * 0.58 : height * 0.66,
          display: 'flex',
          justifyContent: 'center',
          opacity: url,
          transform: `translateY(${(1 - url) * 20}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.text,
            fontWeight: 500,
            fontSize: portrait ? width * 0.05 : width * 0.019,
            letterSpacing: '0.06em',
            color: COLORS.white,
            padding: portrait ? '22px 52px' : '18px 46px',
            borderRadius: 999,
            border: '1px solid rgba(111,195,211,0.55)',
            background: 'linear-gradient(135deg, rgba(111,195,211,0.18), rgba(111,195,211,0.04))',
            boxShadow: `0 0 ${40 * cta}px rgba(111,195,211,0.3), inset 0 1px 0 rgba(255,255,255,0.2)`,
          }}
        >
          {BRAND.url}
        </div>
      </div>
      {BRAND.showQr && (
        <div
          style={{
            position: 'absolute',
            ...(portrait ? { left: width / 2 - width * 0.11, top: height * 0.69 } : { right: width * 0.05, bottom: height * 0.07 }),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            opacity: qr,
          }}
        >
          <Qr value={BRAND.urlFull} size={portrait ? width * 0.22 : width * 0.062} />
          <div style={{ fontFamily: FONTS.text, fontSize: portrait ? 24 : 15, letterSpacing: '0.2em', color: COLORS.silver, textTransform: 'uppercase' }}>Scannez</div>
        </div>
      )}
    </AbsoluteFill>
  );
};
