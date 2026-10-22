import React from 'react';
import { AbsoluteFill } from 'remotion';
import { LightLine, NightBackground, Particles } from '../components/Atmosphere';
import { CliffMark } from '../components/Logo';
import { easeInOut, easeOut, lerp, prog, sceneOpacity, useScene } from '../components/motion';
import { Title } from '../components/Title';
import type { SceneProps } from './types';

/** Scène 1 : noir profond, ligne de lumière, particules, révélation du logo, manifeste. */
export const Manifeste: React.FC<SceneProps> = ({ duration, titles }) => {
  const { t, k, width, height, portrait } = useScene(duration);
  const D = duration;
  const line = prog(k, 0.02, 0.36, easeInOut);
  const lineFade = 1 - prog(k, 0.36, 0.5);
  const reveal = prog(k, 0.3, 0.62, easeInOut); // balayage lumineux sur le logo
  const wave = prog(k, 0.42, 0.68, easeOut);
  const push = lerp(1, 1.08, prog(k, 0, 1, (x) => x));
  const logoW = portrait ? width * 0.5 : width * 0.2;
  const logoY = portrait ? height * 0.36 : height * 0.4;
  const exit = 1 - prog(k, 0.94, 1, easeInOut);
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(k, 0.001, 2) }}>
      <NightBackground glow={prog(k, 0.1, 0.6) * 0.8} beams={prog(k, 0.3, 0.8) * 0.6} />
      <Particles count={portrait ? 130 : 170} speed={0.09} opacity={prog(k, 0.05, 0.4)} seed="m" />
      <AbsoluteFill style={{ transform: `scale(${push})`, opacity: exit }}>
        <LightLine progress={line} y={logoY + logoW * 0.32} fade={lineFade} />
        {/* halo derrière le logo */}
        <div
          style={{
            position: 'absolute',
            left: width / 2 - logoW * 1.4,
            top: logoY - logoW * 0.9,
            width: logoW * 2.8,
            height: logoW * 1.8,
            background: 'radial-gradient(ellipse at center, rgba(111,195,211,0.28) 0%, rgba(111,195,211,0) 65%)',
            opacity: reveal,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: width / 2 - logoW / 2,
            top: logoY - (logoW * 44) / 64 / 2,
            WebkitMaskImage: `linear-gradient(100deg, #000 ${reveal * 140 - 30}%, rgba(0,0,0,0) ${reveal * 140 - 5}%)`,
            maskImage: `linear-gradient(100deg, #000 ${reveal * 140 - 30}%, rgba(0,0,0,0) ${reveal * 140 - 5}%)`,
            filter: `drop-shadow(0 0 ${30 * reveal}px rgba(111,195,211,0.45))`,
          }}
        >
          <CliffMark width={logoW} wave={wave} />
        </div>
        {/* reflet qui traverse le logo une fois révélé */}
        <div
          style={{
            position: 'absolute',
            left: width / 2 - logoW / 2,
            top: logoY - (logoW * 44) / 64 / 2,
            width: logoW,
            height: (logoW * 44) / 64,
            background: `linear-gradient(100deg, rgba(255,255,255,0) ${lerp(-40, 140, prog(k, 0.55, 0.8))}%, rgba(255,255,255,0.35) ${lerp(-30, 150, prog(k, 0.55, 0.8))}%, rgba(255,255,255,0) ${lerp(-20, 160, prog(k, 0.55, 0.8))}%)`,
            mixBlendMode: 'overlay',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: logoY + logoW * 0.55,
            display: 'flex',
            justifyContent: 'center',
            padding: '0 8%',
          }}
        >
          <Title
            text={titles[0]}
            t={t}
            from={D * 0.56}
            to={D * 1.2}
            size={portrait ? width * 0.072 : width * 0.033}
            weight={300}
            maxWidth={portrait ? width * 0.84 : width * 0.7}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
