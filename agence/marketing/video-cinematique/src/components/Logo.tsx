import React, { useId } from 'react';
import { COLORS, FONTS } from '../config/brand';

// Pictogramme officiel du site (agence/src/web/layout.tsx, CliffMark) : tracés et proportions inchangés.
const FALAISE = 'M2 34V9Q16 7 28 11Q38 14 42 19Q44 23 43 34H37Q37 25 32 25Q27 25 27 34Z';
const AIGUILLE = 'M49 34L51.5 15L54.5 34Z';
const VAGUE = 'M2 40c5-3 10-3 15 0s10 3 15 0 10-3 15 0 10 3 15 0';
const LONGUEUR_VAGUE = 66;

type Props = {
  width: number;
  /** 'metal' : dégradé argenté ; sinon couleur unie. */
  fill?: 'metal' | string;
  /** Tracé progressif de la vague (0 → 1). */
  wave?: number;
  style?: React.CSSProperties;
};

export const CliffMark: React.FC<Props> = ({ width, fill = 'metal', wave = 1, style }) => {
  const id = useId().replace(/:/g, '');
  const color = fill === 'metal' ? `url(#m${id})` : fill;
  return (
    <svg width={width} height={(width * 44) / 64} viewBox="0 0 64 44" style={{ overflow: 'visible', ...style }}>
      <defs>
        <linearGradient id={`m${id}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#E3EBEE" />
          <stop offset="0.75" stopColor="#AFC0C5" />
          <stop offset="1" stopColor="#8DA2A8" />
        </linearGradient>
      </defs>
      <path fill={color} d={FALAISE} />
      <path fill={color} d={AIGUILLE} />
      <path
        d={VAGUE}
        stroke={COLORS.accent}
        strokeWidth={2.6}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={LONGUEUR_VAGUE}
        strokeDashoffset={LONGUEUR_VAGUE * (1 - wave)}
      />
    </svg>
  );
};

/** « SIGNE & SEINE » en capitales espacées, esperluette orange. */
export const Wordmark: React.FC<{ size: number; color?: string; spacing?: number; style?: React.CSSProperties }> = ({
  size,
  color = COLORS.white,
  spacing = 0.32,
  style,
}) => (
  <div
    style={{
      fontFamily: FONTS.display,
      fontWeight: 600,
      fontSize: size,
      letterSpacing: `${spacing}em`,
      color,
      whiteSpace: 'nowrap',
      marginRight: `-${spacing}em`,
      ...style,
    }}
  >
    SIGNE <span style={{ color: COLORS.accent }}>&amp;</span> SEINE
  </div>
);
