import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLORS} from '../animations/timing';
import {BrandMark} from './Brand';

export const SceneFrame: React.FC<{
  children: React.ReactNode;
  opacity?: number;
  showBrand?: boolean;
  tone?: 'dark' | 'light';
}> = ({children, opacity = 1, showBrand = true, tone = 'dark'}) => {
  const light = tone === 'light';
  return (
    <AbsoluteFill
      style={{
        opacity,
        overflow: 'hidden',
        fontFamily: 'Inter, Arial, sans-serif',
        color: light ? COLORS.ink : COLORS.white,
        background: light
          ? 'radial-gradient(circle at 78% 15%, rgba(199,164,54,.14), transparent 28%), linear-gradient(145deg,#F8FAFC,#EEF2F7)'
          : `radial-gradient(circle at 72% 16%, rgba(8,73,141,.34), transparent 32%), radial-gradient(circle at 18% 86%, rgba(49,132,92,.18), transparent 30%), linear-gradient(145deg,${COLORS.ink},${COLORS.navy})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: light ? 0.25 : 0.16,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'linear-gradient(to bottom,black,transparent 88%)',
        }}
      />
      <div style={{position: 'absolute', inset: 0, boxShadow: 'inset 0 0 180px rgba(0,0,0,.35)', pointerEvents: 'none'}} />
      {showBrand && (
        <div style={{position: 'absolute', left: 72, top: 54, zIndex: 30}}>
          <BrandMark scale={0.82} onLight={light} />
        </div>
      )}
      {children}
    </AbsoluteFill>
  );
};

export const SceneCopy: React.FC<{
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: 'left' | 'center';
  style?: React.CSSProperties;
}> = ({eyebrow, title, subtitle, align = 'left', style}) => (
  <div style={{textAlign: align, ...style}}>
    {eyebrow && (
      <div style={{color: COLORS.goldLight, fontSize: 16, fontWeight: 800, letterSpacing: 2.2, textTransform: 'uppercase', marginBottom: 16}}>
        {eyebrow}
      </div>
    )}
    <div style={{fontSize: 63, lineHeight: 1.04, letterSpacing: -3.2, fontWeight: 800}}>{title}</div>
    {subtitle && (
      <div style={{marginTop: 22, color: COLORS.muted, fontSize: 25, lineHeight: 1.42, fontWeight: 500}}>{subtitle}</div>
    )}
  </div>
);
