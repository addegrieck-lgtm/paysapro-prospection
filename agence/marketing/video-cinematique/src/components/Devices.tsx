import React from 'react';

/** Reflet de verre qui glisse sur un écran selon l'angle de caméra. */
const Glare: React.FC<{ angle: number }> = ({ angle }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: `linear-gradient(${115 + angle}deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.13) 45%, rgba(255,255,255,0) 60%)`,
      pointerEvents: 'none',
    }}
  />
);

/** Ordinateur portable en CSS 3D : écran et plateau aluminium. */
export const Laptop: React.FC<{ width: number; angle: number; children: React.ReactNode }> = ({ width, angle, children }) => {
  const sh = width * 0.625;
  const bezel = width * 0.018;
  return (
    <div style={{ position: 'relative', width, height: sh, transformStyle: 'preserve-3d' }}>
      {/* écran */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: width * 0.022,
          background: '#07090A',
          border: `${width * 0.002}px solid #5E6A6E`,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 40px 120px rgba(0,0,0,0.6), 0 0 80px rgba(111,195,211,0.15)',
          padding: bezel,
          transformOrigin: '50% 100%',
          transform: 'rotateX(-6deg)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: '100%', height: '100%', borderRadius: width * 0.006, overflow: 'hidden', position: 'relative' }}>
          {children}
          <Glare angle={angle} />
        </div>
      </div>
      {/* plateau */}
      <div
        style={{
          position: 'absolute',
          left: -width * 0.06,
          top: sh,
          width: width * 1.12,
          height: width * 0.6,
          transformOrigin: '50% 0%',
          transform: 'rotateX(84deg)',
          borderRadius: width * 0.03,
          background: 'linear-gradient(180deg, #B9C3C6 0%, #8E999C 55%, #6E787B 100%)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '9%',
            right: '9%',
            top: '8%',
            height: '48%',
            borderRadius: width * 0.01,
            background: 'repeating-linear-gradient(90deg, #2C3437 0 3.4%, #3A4447 3.4% 3.9%)',
            opacity: 0.85,
          }}
        />
        <div style={{ position: 'absolute', left: '36%', right: '36%', top: '62%', height: '28%', borderRadius: width * 0.008, background: 'rgba(0,0,0,0.12)' }} />
      </div>
    </div>
  );
};

/** Smartphone en CSS : cadre métallique et encoche. */
export const Phone: React.FC<{ width: number; angle: number; children: React.ReactNode }> = ({ width, angle, children }) => {
  const h = width * 2.05;
  return (
    <div
      style={{
        width,
        height: h,
        borderRadius: width * 0.16,
        background: 'linear-gradient(135deg, #D7DFE2 0%, #7E898D 40%, #C5CED1 70%, #6B7579 100%)',
        padding: width * 0.022,
        boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 60px rgba(111,195,211,0.18)',
      }}
    >
      <div style={{ width: '100%', height: '100%', borderRadius: width * 0.145, background: '#050607', padding: width * 0.035, position: 'relative' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: width * 0.115, overflow: 'hidden', position: 'relative' }}>
          {children}
          <Glare angle={angle} />
        </div>
        <div
          style={{
            position: 'absolute',
            top: width * 0.06,
            left: '50%',
            width: width * 0.3,
            height: width * 0.085,
            borderRadius: 999,
            background: '#050607',
            transform: 'translateX(-50%)',
          }}
        />
      </div>
    </div>
  );
};
