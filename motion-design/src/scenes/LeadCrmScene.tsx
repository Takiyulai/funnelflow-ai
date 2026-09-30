import React from 'react';
import {ArrowRight, Check, Mail, UserPlus, Users} from 'lucide-react';
import {useCurrentFrame} from 'remotion';
import {COLORS, fadeWindow, mix, pop, reveal} from '../animations/timing';
import {Chip, ProductWindow, UiButton} from '../components/ProductWindow';
import {SceneFrame} from '../components/SceneFrame';

export const LeadCrmScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 210;
  const opacity = fadeWindow(frame, duration, 12, 16);
  const formIn = reveal(frame, 0, 28);
  const submitted = reveal(frame, 56, 20);
  const travel = reveal(frame, 78, 56);
  const rowIn = reveal(frame, 128, 25);
  const contactX = mix(travel, [0, 1], [590, 1160]);
  const contactY = mix(travel, [0, 1], [520, 434]);

  return (
    <SceneFrame opacity={opacity} tone="light">
      <div style={{position: 'absolute', left: 112, top: 110}}>
        <div style={{fontSize: 17, fontWeight: 800, letterSpacing: 1.7, textTransform: 'uppercase', color: COLORS.green}}>Capture → CRM</div>
        <div style={{fontSize: 54, lineHeight: 1.08, letterSpacing: -2.4, fontWeight: 900, color: COLORS.ink, marginTop: 12}}>Chaque inscription<br />arrive au bon endroit.</div>
      </div>

      <div style={{position: 'absolute', left: 95, top: 360, opacity: formIn, transform: `translateX(${(1 - formIn) * -40}px)`}}>
        <div style={{width: 600, height: 520, borderRadius: 28, background: COLORS.navy, boxShadow: '0 34px 80px rgba(8,14,26,.25)', padding: 46, color: 'white', position: 'relative', overflow: 'hidden'}}>
          <div style={{position: 'absolute', width: 280, height: 280, right: -90, top: -100, borderRadius: 999, background: 'rgba(8,73,141,.45)', filter: 'blur(2px)'}} />
          <div style={{position: 'relative'}}>
            <div style={{fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: COLORS.goldLight}}>CHECKLIST OFFERTE</div>
            <div style={{fontSize: 35, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.1, marginTop: 12}}>Clarifie ton offre<br />en 20 minutes.</div>
            <div style={{fontSize: 15, lineHeight: 1.5, color: '#94A3B8', width: 420, marginTop: 13}}>Reçois le guide et la séquence d'accompagnement directement par email.</div>
            <div style={{display: 'grid', gap: 10, marginTop: 26}}>
              <InputLike value="Awa Mensah" />
              <InputLike value="awa@studio-mensah.fr" icon={<Mail size={14} />} />
            </div>
            <UiButton tone={submitted > 0.7 ? 'green' : 'gold'} style={{width: '100%', marginTop: 14, height: 48, transform: `scale(${1 - pop(frame, 54) * 0.035})`}}>
              {submitted > 0.7 ? <><Check size={18} /> Inscription confirmée</> : <>Recevoir la checklist <ArrowRight size={17} /></>}
            </UiButton>
          </div>
        </div>
      </div>

      <div style={{position: 'absolute', left: 840, top: 295, opacity: reveal(frame, 40, 36), transform: `translateX(${(1 - reveal(frame, 40, 36)) * 60}px)`}}>
        <ProductWindow width={980} height={650} title="CRM — Contacts">
          <div style={{display: 'flex', height: '100%', color: COLORS.ink}}>
            <aside style={{width: 175, background: COLORS.navy, color: 'white', padding: '25px 18px'}}>
              <div style={{display: 'flex', gap: 9, alignItems: 'center', fontWeight: 800, fontSize: 13}}><Users size={17} color={COLORS.gold} /> CRM</div>
              {['Tous les contacts', 'Nouveaux', 'Qualifiés', 'Clients'].map((label, i) => <div key={label} style={{fontSize: 11, color: i === 0 ? 'white' : '#94A3B8', marginTop: 20, background: i === 0 ? 'rgba(255,255,255,.07)' : 'transparent', padding: i === 0 ? '9px 10px' : '0 10px', borderRadius: 7}}>{label}</div>)}
            </aside>
            <main style={{flex: 1, padding: '28px 30px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div><div style={{fontSize: 24, fontWeight: 900}}>CRM</div><div style={{fontSize: 11, color: '#6F7681', marginTop: 4}}>Contacts, listes, tags et suivi commercial.</div></div>
                <UiButton tone="blue" style={{height: 36, fontSize: 11}}><UserPlus size={14} /> Nouveau contact</UiButton>
              </div>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, marginTop: 22}}>
                {[['Total', '128'], ['Nouveaux', '17'], ['Qualifiés', '42'], ['Clients', '29']].map(([label, value], i) => (
                  <div key={label} style={{padding: '13px 14px', borderRadius: 10, background: 'white', border: '1px solid #DFE1E6'}}><div style={{fontSize: 9, fontWeight: 800, color: '#6F7681', textTransform: 'uppercase'}}>{label}</div><div style={{fontSize: 22, fontWeight: 900, marginTop: 5, color: i === 1 && rowIn > 0.8 ? COLORS.green : COLORS.ink}}>{i === 0 && rowIn > 0.8 ? '129' : i === 1 && rowIn > 0.8 ? '18' : value}</div></div>
                ))}
              </div>
              <div style={{marginTop: 20, border: '1px solid #DFE1E6', borderRadius: 12, overflow: 'hidden'}}>
                <div style={{height: 38, display: 'grid', gridTemplateColumns: '1.7fr 1fr 1fr .7fr', alignItems: 'center', padding: '0 14px', background: '#F4F5F7', color: '#6F7681', fontSize: 9, fontWeight: 800, textTransform: 'uppercase'}}><span>Contact</span><span>Liste</span><span>Tags</span><span>Statut</span></div>
                {[['Jules Martin', 'Newsletter', 'Prospect', 'Qualifié'], ['Maya Diallo', 'Webinaire', 'Intéressé', 'Nouveau']].map((r) => <CrmRow key={r[0]} values={r} />)}
                <div style={{opacity: rowIn, transform: `translateY(${(1 - rowIn) * -18}px)`, boxShadow: `inset 3px 0 ${COLORS.gold}`}}>
                  <CrmRow values={['Awa Mensah', 'Checklist', 'Intéressé', 'Nouveau']} active />
                </div>
              </div>
            </main>
          </div>
        </ProductWindow>
      </div>

      {travel > 0.02 && travel < 0.98 && (
        <div style={{position: 'absolute', left: contactX, top: contactY, width: 210, height: 70, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '0 15px', background: 'white', border: `1px solid ${COLORS.gold}66`, boxShadow: '0 18px 45px rgba(8,14,26,.22)', transform: `scale(${0.86 + Math.sin(travel * Math.PI) * 0.14})`, zIndex: 20}}>
          <span style={{width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${COLORS.green}18`, color: COLORS.green}}><UserPlus size={20} /></span>
          <div><div style={{fontSize: 12, fontWeight: 900, color: COLORS.ink}}>Awa Mensah</div><div style={{fontSize: 9, color: '#6F7681', marginTop: 3}}>Nouveau contact</div></div>
        </div>
      )}
    </SceneFrame>
  );
};

const InputLike: React.FC<{value: string; icon?: React.ReactNode}> = ({value, icon}) => (
  <div style={{height: 46, borderRadius: 10, background: 'white', color: COLORS.ink, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', fontSize: 13, fontWeight: 600}}>{icon}{value}</div>
);

const CrmRow: React.FC<{values: string[]; active?: boolean}> = ({values, active}) => (
  <div style={{height: 62, display: 'grid', gridTemplateColumns: '1.7fr 1fr 1fr .7fr', alignItems: 'center', padding: '0 14px', background: active ? '#FFFCF2' : 'white', borderTop: '1px solid #EBECEF', fontSize: 10}}>
    <div><div style={{fontWeight: 800}}>{values[0]}</div><div style={{fontSize: 8, color: '#6F7681', marginTop: 3}}>{values[0].toLowerCase().replace(' ', '.')}@email.fr</div></div>
    <span>{values[1]}</span>
    <span><Chip tone={active ? 'gold' : 'blue'}>{values[2]}</Chip></span>
    <span><Chip tone={active ? 'green' : 'neutral'}>{values[3]}</Chip></span>
  </div>
);
