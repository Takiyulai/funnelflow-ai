import React from 'react';
import {ArrowRight, Check, FileText, GitBranch, Mail, Users} from 'lucide-react';
import {useCurrentFrame} from 'remotion';
import {COLORS, fadeWindow, mix, pop, reveal} from '../animations/timing';
import {BrandMark, BrandPill} from '../components/Brand';
import {SceneFrame} from '../components/SceneFrame';

const systemItems = [
  {label: 'Tunnel', icon: FileText, angle: -145},
  {label: 'CRM', icon: Users, angle: -50},
  {label: 'Emails', icon: Mail, angle: 45},
  {label: 'Workflows', icon: GitBranch, angle: 140},
] as const;

export const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 150;
  const opacity = fadeWindow(frame, duration, 8, 4);
  const enter = reveal(frame, 0, 32);
  const button = pop(frame, 58, 15);

  return (
    <SceneFrame opacity={opacity} showBrand={false}>
      <div style={{position: 'absolute', left: 145, top: 120, width: 770, opacity: enter, transform: `translateX(${(1 - enter) * -42}px)`}}>
        <BrandMark scale={1.08} />
        <div style={{marginTop: 70}}><BrandPill>Ta machine de vente, dans une seule application</BrandPill></div>
        <div style={{fontSize: 72, lineHeight: 1.02, letterSpacing: -4.2, fontWeight: 900, marginTop: 28}}>Tout ton système<br />de vente. <span style={{color: COLORS.gold}}>Connecté.</span></div>
        <div style={{fontSize: 24, lineHeight: 1.5, color: COLORS.muted, marginTop: 23, width: 650}}>Crée, publie, capte et relance depuis AutoFunnelAI.</div>
        <div style={{display: 'inline-flex', alignItems: 'center', gap: 13, height: 64, marginTop: 35, padding: '0 25px', borderRadius: 14, background: COLORS.gold, color: COLORS.ink, fontSize: 18, fontWeight: 900, boxShadow: '0 18px 48px rgba(199,164,54,.28)', transform: `scale(${0.9 + button * 0.1})`}}>Créer mon premier tunnel <ArrowRight size={21} /></div>
        <div style={{display: 'flex', gap: 22, marginTop: 22, color: '#CBD5E1', fontSize: 12, fontWeight: 700}}><span><Check size={14} color={COLORS.green} style={{verticalAlign: -3, marginRight: 6}} />Commencer gratuitement</span><span><Check size={14} color={COLORS.green} style={{verticalAlign: -3, marginRight: 6}} />Sans engagement</span></div>
      </div>

      <div style={{position: 'absolute', left: 1070, top: 145, width: 700, height: 700, opacity: reveal(frame, 18, 40), transform: `scale(${0.9 + reveal(frame, 18, 40) * 0.1}) rotate(${mix(frame, [0, 150], [-2, 2])}deg)`}}>
        <div style={{position: 'absolute', left: 235, top: 235, width: 230, height: 230, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'radial-gradient(circle,rgba(199,164,54,.26),rgba(199,164,54,.06) 55%,transparent 70%)', border: '1px solid rgba(199,164,54,.28)', boxShadow: '0 0 110px rgba(199,164,54,.20)'}}>
          <div style={{width: 108, height: 108, borderRadius: 28, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg,${COLORS.green},${COLORS.blue})`, fontSize: 30, fontWeight: 900, color: 'white', boxShadow: '0 30px 70px rgba(8,73,141,.32)'}}>AF</div>
        </div>
        <svg width="700" height="700" style={{position: 'absolute', inset: 0}}>
          <circle cx="350" cy="350" r="265" fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="2" strokeDasharray="8 12" />
        </svg>
        {systemItems.map((item, i) => {
          const rad = (item.angle * Math.PI) / 180;
          const x = 350 + Math.cos(rad) * 265 - 92;
          const y = 350 + Math.sin(rad) * 265 - 56;
          const Icon = item.icon;
          const p = pop(frame, 28 + i * 6);
          return (
            <div key={item.label} style={{position: 'absolute', left: x, top: y, width: 184, height: 112, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, background: 'rgba(21,36,57,.94)', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 24px 55px rgba(0,0,0,.24)', color: 'white', transform: `scale(${0.78 + p * 0.22})`}}>
              <Icon size={23} color={i === 0 ? COLORS.gold : i === 1 ? '#5FBE8E' : '#6BA6E8'} />
              <span style={{fontSize: 13, fontWeight: 800}}>{item.label}</span>
            </div>
          );
        })}
      </div>
    </SceneFrame>
  );
};
