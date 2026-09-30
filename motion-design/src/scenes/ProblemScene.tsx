import React from 'react';
import {useCurrentFrame} from 'remotion';
import {FileText, FormInput, GitBranch, Mail, Users} from 'lucide-react';
import {COLORS, fadeWindow, mix, pop, reveal} from '../animations/timing';
import {SceneCopy, SceneFrame} from '../components/SceneFrame';

const cards = [
  {label: 'Page', icon: FileText, from: [1030, 180], to: [1020, 260], rotate: -7},
  {label: 'Formulaire', icon: FormInput, from: [1450, 255], to: [1420, 310], rotate: 6},
  {label: 'CRM', icon: Users, from: [1140, 760], to: [1050, 700], rotate: 8},
  {label: 'Emails', icon: Mail, from: [1510, 700], to: [1430, 690], rotate: -8},
  {label: 'Relances', icon: GitBranch, from: [1290, 470], to: [1240, 480], rotate: 3},
] as const;

export const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 330;
  const opacity = fadeWindow(frame, duration, 12, 14);
  const connect = reveal(frame, 160, 55);
  const scatterCopy = mix(frame, [138, 170], [1, 0]);
  const systemCopy = mix(frame, [155, 192], [0, 1]);

  return (
    <SceneFrame opacity={opacity}>
      <div style={{position: 'absolute', left: 118, top: 296, width: 700}}>
        <div style={{opacity: scatterCopy, transform: `translateY(${mix(frame, [0, 28], [28, 0])}px)`}}>
          <SceneCopy
            eyebrow="Le problème"
            title={<>Une page seule<br /><span style={{color: COLORS.gold}}>ne vend pas</span> à ta place.</>}
            subtitle="Créer, capter, suivre, relancer… quand chaque étape vit ailleurs, le système dépend encore de toi."
          />
        </div>
        <div style={{position: 'absolute', inset: 0, opacity: systemCopy, transform: `translateY(${mix(frame, [155, 205], [34, 0])}px)`}}>
          <SceneCopy
            eyebrow="La prise de conscience"
            title={<>Le vrai levier :<br /><span style={{color: COLORS.gold}}>tout connecter.</span></>}
            subtitle="Un seul parcours, de l'offre jusqu'au suivi du contact."
          />
        </div>
      </div>

      <div style={{position: 'absolute', left: 900, top: 110, width: 860, height: 820}}>
        <svg width="860" height="820" style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: connect}}>
          {cards.map((card, index) => {
            const x = card.to[0] - 900 + 125;
            const y = card.to[1] - 110 + 55;
            const cx = 390;
            const cy = 420;
            const pathLength = 350;
            return (
              <path
                key={card.label}
                d={`M ${cx} ${cy} Q ${(cx + x) / 2 + (index % 2 ? 30 : -30)} ${(cy + y) / 2} ${x} ${y}`}
                fill="none"
                stroke={index === 4 ? COLORS.gold : 'rgba(199,164,54,.55)'}
                strokeWidth={index === 4 ? 3 : 2}
                strokeDasharray="7 9"
                strokeDashoffset={(1 - connect) * pathLength}
              />
            );
          })}
        </svg>

        <div
          style={{
            position: 'absolute',
            left: 316,
            top: 345,
            width: 150,
            height: 150,
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            background: `radial-gradient(circle, rgba(199,164,54,.24), rgba(199,164,54,.07) 58%, transparent 60%)`,
            border: `1px solid rgba(199,164,54,${0.16 + connect * 0.34})`,
            boxShadow: `0 0 ${40 + connect * 55}px rgba(199,164,54,.18)`,
            opacity: 0.45 + connect * 0.55,
            transform: `scale(${0.82 + pop(frame, 164) * 0.18})`,
          }}
        >
          <div style={{width: 72, height: 72, borderRadius: 20, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg,${COLORS.green},${COLORS.blue})`, fontWeight: 900, fontSize: 24}}>AF</div>
        </div>

        {cards.map((card, index) => {
          const arrange = reveal(frame, 150 + index * 4, 58);
          const x = mix(arrange, [0, 1], [card.from[0] - 900, card.to[0] - 900]);
          const y = mix(arrange, [0, 1], [card.from[1] - 110, card.to[1] - 110]);
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: 250,
                height: 110,
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 17,
                padding: '0 22px',
                color: COLORS.white,
                background: connect > 0.6 ? 'rgba(21,36,57,.96)' : 'rgba(21,36,57,.74)',
                border: `1px solid rgba(255,255,255,${0.08 + connect * 0.09})`,
                boxShadow: '0 25px 60px rgba(0,0,0,.28)',
                transform: `rotate(${card.rotate * (1 - arrange)}deg) scale(${0.92 + arrange * 0.08})`,
                backdropFilter: 'blur(14px)',
              }}
            >
              <span style={{width: 50, height: 50, borderRadius: 14, display: 'grid', placeItems: 'center', background: `${index === 4 ? COLORS.gold : COLORS.blue}22`, color: index === 4 ? COLORS.gold : '#6BA6E8'}}>
                <Icon size={25} strokeWidth={2.2} />
              </span>
              <div>
                <div style={{fontSize: 20, fontWeight: 800}}>{card.label}</div>
                <div style={{fontSize: 12, color: COLORS.muted, marginTop: 5}}>{connect > 0.65 ? 'Connecté' : 'Outil séparé'}</div>
              </div>
              {connect > 0.62 && <span style={{marginLeft: 'auto', width: 9, height: 9, borderRadius: 99, background: COLORS.green, boxShadow: `0 0 14px ${COLORS.green}`}} />}
            </div>
          );
        })}
      </div>
    </SceneFrame>
  );
};
