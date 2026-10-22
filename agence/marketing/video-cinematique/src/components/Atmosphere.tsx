import React from 'react';
import { AbsoluteFill, random, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../config/brand';

/** Fond nuit : dégradé profond, halo central, faisceaux volumétriques discrets. */
export const NightBackground: React.FC<{ glow?: number; beams?: number; tint?: string }> = ({
  glow = 0.6,
  beams = 0.5,
  tint = COLORS.deep,
}) => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame / 90) * 6;
  return (
    <AbsoluteFill style={{ background: COLORS.night }}>
      <AbsoluteFill
        style={{ background: `radial-gradient(ellipse 75% 60% at 50% 55%, ${tint} 0%, ${COLORS.night} 72%)`, opacity: glow }}
      />
      <AbsoluteFill style={{ opacity: beams, mixBlendMode: 'screen' }}>
        {[-18, 4, 22].map((angle, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '-30%',
              width: '34%',
              height: '140%',
              transformOrigin: '50% 0%',
              transform: `translateX(-50%) rotate(${angle + sway * (i - 1) * 0.5}deg)`,
              background: `linear-gradient(180deg, rgba(111,195,211,${0.1 - i * 0.02}) 0%, rgba(111,195,211,0) 70%)`,
              clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)',
            }}
          />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Vignettage et grain film, à poser au-dessus de tout. */
export const Finish: React.FC = () => {
  const frame = useCurrentFrame();
  const x = Math.floor(random(`gx${frame}`) * 256);
  const y = Math.floor(random(`gy${frame}`) * 256);
  return (
    <>
      <AbsoluteFill
        style={{ background: 'radial-gradient(ellipse 80% 75% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile('grain.png')})`,
          backgroundPosition: `${x}px ${y}px`,
          opacity: 0.05,
          mixBlendMode: 'overlay',
        }}
      />
    </>
  );
};

type ParticlesProps = {
  count?: number;
  /** Vitesse d'avancée de la caméra (unités de profondeur par seconde). */
  speed?: number;
  /** 0 : particules libres, 1 : toutes aspirées vers le centre. */
  attract?: number;
  opacity?: number;
  seed?: string;
};

/** Poussière lumineuse en 3D projetée : la caméra avance à travers. */
export const Particles: React.FC<ParticlesProps> = ({ count = 160, speed = 0.12, attract = 0, opacity = 1, seed = 'p' }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const cx = width / 2;
  const cy = height / 2;
  const focal = Math.max(width, height) * 0.55;
  const dots = Array.from({ length: count }, (_, i) => {
    const x = (random(`${seed}x${i}`) - 0.5) * 2.4;
    const y = (random(`${seed}y${i}`) - 0.5) * 1.6;
    const z0 = random(`${seed}z${i}`);
    const z = ((((z0 - t * speed) % 1) + 1) % 1) * 1.6 + 0.12;
    let sx = cx + (x / z) * focal;
    let sy = cy + (y / z) * focal;
    sx += (cx - sx) * attract * (0.7 + 0.3 * random(`${seed}a${i}`));
    sy += (cy - sy) * attract * (0.7 + 0.3 * random(`${seed}a${i}`));
    const r = Math.min(4.2, 1.1 / z) * (0.5 + random(`${seed}r${i}`));
    const fadeNear = Math.min(1, (z - 0.12) / 0.25);
    const fadeFar = Math.min(1, (1.72 - z) / 0.5);
    const twinkle = 0.65 + 0.35 * Math.sin(t * 2 + i);
    return { sx, sy, r, a: fadeNear * fadeFar * twinkle * (0.25 + 0.6 * random(`${seed}o${i}`)) };
  });
  return (
    <AbsoluteFill style={{ opacity }}>
      <svg width={width} height={height}>
        <defs>
          <radialGradient id={`pg${seed}`}>
            <stop offset="0" stopColor="#E6F7FB" />
            <stop offset="0.4" stopColor={COLORS.glow} stopOpacity="0.55" />
            <stop offset="1" stopColor={COLORS.glow} stopOpacity="0" />
          </radialGradient>
        </defs>
        {dots.map((d, i) =>
          d.sx > -20 && d.sx < width + 20 && d.sy > -20 && d.sy < height + 20 ? (
            <circle key={i} cx={d.sx} cy={d.sy} r={d.r * 2.6} fill={`url(#pg${seed})`} opacity={d.a} />
          ) : null,
        )}
      </svg>
    </AbsoluteFill>
  );
};

/** Ligne lumineuse horizontale qui traverse l'écran (tête brillante, traîne bleutée). */
export const LightLine: React.FC<{ progress: number; y: number; fade?: number; width?: number }> = ({
  progress,
  y,
  fade = 1,
  width,
}) => {
  const { width: W } = useVideoConfig();
  const w = width ?? W;
  const head = progress * (w + 400) - 200;
  return (
    <div style={{ position: 'absolute', left: (W - w) / 2, top: y, width: w, height: 0, opacity: fade }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: -1,
          height: 2,
          width: Math.max(0, head),
          background: `linear-gradient(90deg, rgba(111,195,211,0) 0%, rgba(111,195,211,0.55) 70%, #F2FBFD 100%)`,
          boxShadow: '0 0 18px 2px rgba(111,195,211,0.55)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: head - 90,
          top: -45,
          width: 180,
          height: 90,
          background: 'radial-gradient(ellipse at center, rgba(242,251,253,0.9) 0%, rgba(111,195,211,0.35) 25%, rgba(111,195,211,0) 70%)',
        }}
      />
    </div>
  );
};
