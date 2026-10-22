import { createContext, useContext } from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Progression 0 → 1 entre a et b, avec courbe. */
export const prog = (x: number, a: number, b: number, ease: (n: number) => number = Easing.bezier(0.45, 0, 0.2, 1)) =>
  interpolate(x, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Contexte d'une scène : temps local (s), progression k (0 → 1) et format. */
export function useScene(duration: number) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  return { frame, fps, t, k: clamp01(t / duration), width, height, portrait: height > width };
}

/** Fondu d'entrée et de sortie d'une scène (en fraction de sa durée ; outStart ≥ 1 : pas de sortie). */
export const sceneOpacity = (k: number, inEnd = 0.04, outStart = 0.95) =>
  Math.min(prog(k, 0, inEnd, easeOut), outStart >= 1 ? 1 : 1 - prog(k, outStart, 1, easeInOut));

/** Hauteur (fraction de l'écran) réservée en bas aux sous-titres incrustés. */
export const SubtitleSpace = createContext(0);

/** Position basse d'un titre (en %), relevée quand des sous-titres occupent le bas de l'écran. */
export const useBottom = (base: number) => `${base + useContext(SubtitleSpace) * 100}%`;
