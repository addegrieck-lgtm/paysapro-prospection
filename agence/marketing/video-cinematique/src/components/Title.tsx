import React from 'react';
import { COLORS, FONTS } from '../config/brand';
import { easeInOut, easeOut, prog } from './motion';

type Props = {
  text: string;
  /** Temps local (s) courant de la scène. */
  t: number;
  /** Apparition et disparition (s, temps local). */
  from: number;
  to: number;
  size: number;
  align?: 'left' | 'center';
  weight?: number;
  color?: string;
  maxWidth?: number;
  style?: React.CSSProperties;
};

/** Titre révélé mot à mot : flou → net, légère montée. Disparaît en fondu. */
export const Title: React.FC<Props> = ({
  text,
  t,
  from,
  to,
  size,
  align = 'center',
  weight = 400,
  color = COLORS.white,
  maxWidth,
  style,
}) => {
  if (!text) return null;
  const words = text.split(' ');
  const stagger = Math.min(0.09, 0.9 / words.length);
  const out = 1 - prog(t, to - 0.45, to, easeInOut);
  return (
    <div
      style={{
        fontFamily: FONTS.display,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.12,
        letterSpacing: '0.01em',
        color,
        textAlign: align,
        maxWidth,
        opacity: out,
        textShadow: '0 0 40px rgba(111,195,211,0.25)',
        ...style,
      }}
    >
      {words.map((w, i) => {
        const k = prog(t, from + i * stagger, from + i * stagger + 0.7, easeOut);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: k,
              filter: `blur(${(1 - k) * 12}px)`,
              transform: `translateY(${(1 - k) * 0.35}em)`,
              marginRight: i < words.length - 1 ? '0.28em' : 0,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Petit libellé en capitales espacées. */
export const Kicker: React.FC<{ text: string; opacity: number; size?: number; style?: React.CSSProperties }> = ({
  text,
  opacity,
  size = 20,
  style,
}) => (
  <div
    style={{
      fontFamily: FONTS.text,
      fontWeight: 500,
      fontSize: size,
      letterSpacing: '0.32em',
      textTransform: 'uppercase',
      color: COLORS.glow,
      opacity,
      ...style,
    }}
  >
    {text}
  </div>
);
