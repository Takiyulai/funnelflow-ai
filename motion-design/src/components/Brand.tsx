import React from 'react';
import {COLORS} from '../animations/timing';

export const BrandMark: React.FC<{compact?: boolean; scale?: number; onLight?: boolean}> = ({
  compact = false,
  scale = 1,
  onLight = false,
}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 13 * scale, transform: `scale(${scale})`, transformOrigin: 'left center'}}>
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        display: 'grid',
        placeItems: 'center',
        color: 'white',
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: -0.4,
        background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.blue})`,
        boxShadow: '0 12px 34px rgba(8,73,141,.28)',
      }}
    >
      AF
    </div>
    {!compact && (
      <div style={{fontSize: 24, fontWeight: 800, letterSpacing: -0.7, color: onLight ? COLORS.ink : COLORS.white}}>
        AutoFunnel <span style={{color: COLORS.gold}}>AI</span>
      </div>
    )}
  </div>
);

export const BrandPill: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 9,
      border: `1px solid rgba(199,164,54,.28)`,
      background: 'rgba(199,164,54,.10)',
      color: COLORS.goldLight,
      borderRadius: 999,
      padding: '9px 14px',
      fontWeight: 700,
      fontSize: 17,
      letterSpacing: 0.2,
    }}
  >
    <span style={{width: 7, height: 7, borderRadius: 99, background: COLORS.gold, boxShadow: `0 0 18px ${COLORS.gold}`}} />
    {children}
  </div>
);
