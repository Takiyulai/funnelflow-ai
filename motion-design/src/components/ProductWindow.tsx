import React from 'react';
import {COLORS} from '../animations/timing';
import {BrandMark} from './Brand';

export const ProductWindow: React.FC<{
  children: React.ReactNode;
  width?: number;
  height?: number;
  title?: string;
  dark?: boolean;
  style?: React.CSSProperties;
}> = ({children, width = 1180, height = 700, title = 'AutoFunnel AI', dark = false, style}) => (
  <div
    style={{
      width,
      height,
      position: 'relative',
      borderRadius: 24,
      overflow: 'hidden',
      border: dark ? '1px solid rgba(255,255,255,.11)' : '1px solid rgba(8,14,26,.10)',
      background: dark ? '#0D111A' : '#FAFAFB',
      boxShadow: '0 48px 110px rgba(0,0,0,.34), 0 12px 30px rgba(8,14,26,.18)',
      ...style,
    }}
  >
    <div
      style={{
        height: 58,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 20px',
        borderBottom: dark ? '1px solid rgba(255,255,255,.08)' : '1px solid #DFE1E6',
        background: dark ? '#151920' : '#FFFFFF',
      }}
    >
      <div style={{display: 'flex', gap: 8}}>
        {['#FF6B6B', '#F7C948', '#4DBD7C'].map((c) => (
          <span key={c} style={{width: 12, height: 12, borderRadius: 99, background: c}} />
        ))}
      </div>
      <div style={{height: 30, width: 1, background: dark ? 'rgba(255,255,255,.08)' : '#E6E8EC'}} />
      <BrandMark compact scale={0.58} />
      <div style={{fontSize: 14, fontWeight: 700, color: dark ? '#CBD5E1' : COLORS.ink}}>{title}</div>
      <div
        style={{
          marginLeft: 'auto',
          width: 420,
          height: 30,
          borderRadius: 8,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'monospace',
          fontSize: 12,
          color: dark ? '#64748B' : '#9BA1AC',
          background: dark ? '#0B1220' : '#F4F5F7',
        }}
      >
        app.autofunnel.ai
      </div>
    </div>
    <div style={{height: height - 58, position: 'relative'}}>{children}</div>
  </div>
);

export const UiButton: React.FC<{
  children: React.ReactNode;
  tone?: 'gold' | 'blue' | 'dark' | 'green';
  style?: React.CSSProperties;
}> = ({children, tone = 'gold', style}) => {
  const bg = tone === 'gold' ? COLORS.gold : tone === 'blue' ? COLORS.blue : tone === 'green' ? COLORS.green : COLORS.navy2;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        height: 42,
        padding: '0 18px',
        borderRadius: 10,
        background: bg,
        color: tone === 'gold' ? COLORS.ink : 'white',
        fontSize: 14,
        fontWeight: 800,
        boxShadow: `0 8px 22px ${bg}33`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Chip: React.FC<{children: React.ReactNode; tone?: 'gold' | 'green' | 'blue' | 'neutral'}> = ({children, tone = 'neutral'}) => {
  const color = tone === 'gold' ? COLORS.gold : tone === 'green' ? COLORS.green : tone === 'blue' ? COLORS.blue : '#6F7681';
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 99, background: `${color}18`, border: `1px solid ${color}3D`, color, fontSize: 12, fontWeight: 800}}>
      {children}
    </span>
  );
};
