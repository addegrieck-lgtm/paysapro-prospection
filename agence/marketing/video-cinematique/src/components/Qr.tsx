import React from 'react';
import QRCode from 'qrcode';

/** QR code vectoriel (modules carrés), généré au rendu à partir de l'URL. */
export const Qr: React.FC<{ value: string; size: number; color?: string; background?: string }> = ({
  value,
  size,
  color = '#0F2F38',
  background = '#F6F1E8',
}) => {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
  const q = 2; // marge de silence
  return (
    <svg width={size} height={size} viewBox={`${-q} ${-q} ${n + 2 * q} ${n + 2 * q}`} shapeRendering="crispEdges" style={{ borderRadius: size * 0.06, display: 'block' }}>
      <rect x={-q} y={-q} width={n + 2 * q} height={n + 2 * q} fill={background} />
      <path d={d} fill={color} />
    </svg>
  );
};
