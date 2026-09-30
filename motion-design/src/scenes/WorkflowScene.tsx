import React from 'react';
import {Check, Clock, Mail, Tag, Zap} from 'lucide-react';
import {useCurrentFrame} from 'remotion';
import {COLORS, fadeWindow, mix, pop, reveal} from '../animations/timing';
import {Chip, ProductWindow} from '../components/ProductWindow';
import {SceneCopy, SceneFrame} from '../components/SceneFrame';

const nodes = [
  {x: 70, title: 'Un lead est capturé', label: 'Déclencheur', icon: Zap, color: COLORS.gold},
  {x: 330, title: 'Ajouter “Intéressé”', label: 'Ajouter un tag', icon: Tag, color: COLORS.blue},
  {x: 590, title: 'Attendre 1 jour', label: 'Temporisation', icon: Clock, color: '#B8860B'},
  {x: 850, title: 'Email de bienvenue', label: 'Envoyer un email', icon: Mail, color: COLORS.green},
] as const;

export const WorkflowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 210;
  const opacity = fadeWindow(frame, duration, 12, 18);
  const enter = reveal(frame, 0, 30);
  const final = reveal(frame, 158, 28);

  return (
    <SceneFrame opacity={opacity}>
      <div style={{position: 'absolute', left: 104, top: 218, width: 525, opacity: enter, transform: `translateX(${(1 - enter) * -36}px)`}}>
        <SceneCopy
          eyebrow="Automatisation"
          title={<>Le suivi continue.<br /><span style={{color: COLORS.gold}}>Même sans toi.</span></>}
          subtitle="Déclencheurs, délais, tags et emails s'enchaînent selon le parcours que tu définis."
        />
        <div style={{marginTop: 34, display: 'flex', gap: 10}}><Chip tone="green">Workflow actif</Chip><Chip tone="gold">4 étapes</Chip></div>
      </div>

      <div style={{position: 'absolute', left: 680, top: 145, opacity: enter, transform: `translateY(${(1 - enter) * 40}px) scale(${0.96 + enter * 0.04})`}}>
        <ProductWindow width={1120} height={790} title="Workflows — Bienvenue nouveaux leads">
          <div style={{height: 67, display: 'flex', alignItems: 'center', padding: '0 24px', background: 'white', borderBottom: '1px solid #DFE1E6', color: COLORS.ink}}>
            <div><div style={{fontSize: 18, fontWeight: 900}}>Bienvenue nouveaux leads</div><div style={{fontSize: 10, color: '#6F7681', marginTop: 4}}>Se déclenche à chaque nouveau contact capturé</div></div>
            <div style={{marginLeft: 'auto'}}><Chip tone="green">Actif</Chip></div>
          </div>
          <div style={{height: 665, position: 'relative', background: '#FAFAFB', overflow: 'hidden'}}>
            <div style={{position: 'absolute', inset: 0, opacity: 0.55, backgroundImage: 'radial-gradient(#C6C9D0 1px,transparent 1px)', backgroundSize: '22px 22px'}} />
            <svg width="1120" height="665" style={{position: 'absolute', inset: 0}}>
              {nodes.slice(0, -1).map((node, i) => {
                const progress = reveal(frame, 52 + i * 39, 26);
                const x1 = node.x + 215;
                const x2 = nodes[i + 1].x;
                return (
                  <g key={node.title}>
                    <path d={`M ${x1} 325 C ${x1 + 35} 325, ${x2 - 35} 325, ${x2} 325`} stroke="#DFE1E6" strokeWidth="5" fill="none" />
                    <path d={`M ${x1} 325 C ${x1 + 35} 325, ${x2 - 35} 325, ${x2} 325`} stroke={COLORS.green} strokeWidth="5" fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - progress} />
                  </g>
                );
              })}
            </svg>
            {nodes.map((node, i) => {
              const active = reveal(frame, 28 + i * 39, 22);
              const Icon = node.icon;
              return (
                <div key={node.title} style={{position: 'absolute', left: node.x, top: 250, width: 215, height: 150, borderRadius: 17, background: 'white', border: `1.5px solid ${active > 0.7 ? `${node.color}99` : '#DFE1E6'}`, boxShadow: active > 0.5 ? `0 20px 45px ${node.color}20` : '0 10px 28px rgba(8,14,26,.08)', padding: 18, transform: `scale(${0.88 + pop(frame, 26 + i * 39) * 0.12})`, opacity: 0.45 + active * 0.55}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 9}}>
                    <span style={{width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: `${node.color}18`, color: node.color}}><Icon size={18} /></span>
                    <span style={{fontSize: 9, color: '#6F7681', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.7}}>{node.label}</span>
                  </div>
                  <div style={{fontSize: 13, lineHeight: 1.35, fontWeight: 900, color: COLORS.ink, marginTop: 14}}>{node.title}</div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 6, marginTop: 13, color: active > 0.72 ? COLORS.green : '#9BA1AC', fontSize: 9, fontWeight: 800}}>
                    <span style={{width: 7, height: 7, borderRadius: 99, background: active > 0.72 ? COLORS.green : '#C6C9D0', boxShadow: active > 0.72 ? `0 0 12px ${COLORS.green}` : 'none'}} />
                    {active > 0.72 ? 'Exécuté' : 'En attente'}
                  </div>
                </div>
              );
            })}

            <div style={{position: 'absolute', left: 352, bottom: 46, width: 420, height: 84, borderRadius: 15, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', color: 'white', background: COLORS.navy, border: `1px solid ${COLORS.green}55`, boxShadow: '0 20px 50px rgba(8,14,26,.22)', opacity: final, transform: `translateY(${(1 - final) * 24}px) scale(${0.94 + final * 0.06})`}}>
              <span style={{width: 43, height: 43, borderRadius: 13, display: 'grid', placeItems: 'center', background: `${COLORS.green}2A`, color: '#5FBE8E'}}><Check size={22} /></span>
              <div><div style={{fontSize: 14, fontWeight: 900}}>Email de bienvenue envoyé</div><div style={{fontSize: 10, color: '#94A3B8', marginTop: 4}}>Le workflow a exécuté les 4 étapes.</div></div>
            </div>
          </div>
        </ProductWindow>
      </div>
    </SceneFrame>
  );
};
