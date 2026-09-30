import React from 'react';
import {Sparkles, Target, WandSparkles} from 'lucide-react';
import {useCurrentFrame} from 'remotion';
import {COLORS, fadeWindow, mix, pop, reveal} from '../animations/timing';
import {ProductWindow, UiButton} from '../components/ProductWindow';
import {SceneCopy, SceneFrame} from '../components/SceneFrame';

const prompt = 'Je vends un programme de coaching pour indépendants qui veulent structurer leur offre et obtenir plus de demandes qualifiées.';

export const PromptScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 210;
  const opacity = fadeWindow(frame, duration, 12, 16);
  const enter = reveal(frame, 0, 28);
  const typed = Math.floor(mix(frame, [24, 105], [0, prompt.length]));
  const generate = reveal(frame, 108, 28);
  const result = reveal(frame, 135, 42);

  return (
    <SceneFrame opacity={opacity} tone="light">
      <div style={{position: 'absolute', left: 86, top: 245, width: 560, opacity: enter, transform: `translateX(${(1 - enter) * -45}px)`}}>
        <SceneCopy
          eyebrow="La possibilité"
          title={<>Décris<br /><span style={{color: COLORS.blue}}>ton offre.</span></>}
          subtitle="AutoFunnelAI transforme ton brief en parcours structuré — sans partir d'une page blanche."
        />
      </div>

      <div style={{position: 'absolute', left: 690, top: 150, transform: `translateY(${(1 - enter) * 42}px) scale(${0.95 + enter * 0.05})`}}>
        <ProductWindow width={1120} height={750} title="Créer un tunnel">
          <div style={{display: 'flex', height: '100%', color: COLORS.ink}}>
            <aside style={{width: 235, background: COLORS.navy, color: 'white', padding: '28px 22px'}}>
              <div style={{fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.6, fontWeight: 800}}>Création</div>
              {['Format', 'Template', 'Objectif', 'Ton offre', 'Audience'].map((label, index) => (
                <div key={label} style={{display: 'flex', gap: 11, alignItems: 'center', marginTop: 22, color: index === 3 ? 'white' : '#94A3B8', fontSize: 13, fontWeight: index === 3 ? 800 : 600}}>
                  <span style={{width: 25, height: 25, borderRadius: 8, display: 'grid', placeItems: 'center', background: index < 3 ? `${COLORS.green}33` : index === 3 ? COLORS.gold : 'rgba(255,255,255,.06)', color: index === 3 ? COLORS.ink : 'inherit'}}>{index + 1}</span>
                  {label}
                </div>
              ))}
            </aside>
            <main style={{flex: 1, padding: '42px 48px', position: 'relative'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <span style={{width: 44, height: 44, borderRadius: 13, display: 'grid', placeItems: 'center', background: '#E8F1FB', color: COLORS.blue}}><Target size={23} /></span>
                <div>
                  <div style={{fontSize: 26, fontWeight: 800, letterSpacing: -0.8}}>Quelle activité souhaites-tu présenter ?</div>
                  <div style={{fontSize: 13, color: '#6F7681', marginTop: 5}}>Offre, audience, prix et promesse.</div>
                </div>
              </div>

              <div style={{marginTop: 34, border: `1.5px solid ${typed < prompt.length ? COLORS.blue : '#C6C9D0'}`, borderRadius: 15, minHeight: 150, padding: '20px 22px', background: 'white', boxShadow: typed < prompt.length ? '0 0 0 4px rgba(8,73,141,.08)' : 'none', fontSize: 17, lineHeight: 1.6, color: '#262B32'}}>
                {prompt.slice(0, typed)}
                {typed < prompt.length && <span style={{display: 'inline-block', width: 2, height: 20, background: COLORS.blue, marginLeft: 2, verticalAlign: -3}} />}
              </div>

              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24}}>
                <div style={{fontSize: 12, color: '#6F7681'}}>Mode express · français</div>
                <UiButton tone="gold" style={{transform: `scale(${1 + pop(frame, 105) * 0.04})`}}>
                  <Sparkles size={17} /> Générer mon tunnel
                </UiButton>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: 42,
                  right: 42,
                  bottom: 30,
                  height: 170,
                  borderRadius: 18,
                  background: 'linear-gradient(135deg,#F8FAFC,#EEF2F7)',
                  border: '1px solid #DFE1E6',
                  padding: '20px 22px',
                  opacity: result,
                  transform: `translateY(${(1 - result) * 34}px)`,
                }}
              >
                <div style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 800, color: COLORS.green}}>
                  <WandSparkles size={18} /> Parcours structuré
                </div>
                <div style={{display: 'flex', gap: 13, marginTop: 18}}>
                  {['Page de capture', 'Page offre', 'Page merci'].map((name, i) => (
                    <div key={name} style={{flex: 1, height: 82, borderRadius: 12, background: 'white', border: `1px solid ${i === 1 ? `${COLORS.gold}88` : '#DFE1E6'}`, padding: 14, opacity: reveal(frame, 141 + i * 7, 18), transform: `translateY(${(1 - reveal(frame, 141 + i * 7, 18)) * 18}px)`}}>
                      <div style={{fontSize: 12, fontWeight: 800}}>{name}</div>
                      <div style={{display: 'flex', gap: 5, marginTop: 13}}>{[1, 2, 3, 4].map((n) => <span key={n} style={{height: 5, flex: n === 2 ? 2 : 1, borderRadius: 99, background: i === 1 && n === 2 ? `${COLORS.gold}99` : '#DFE1E6'}} />)}</div>
                    </div>
                  ))}
                </div>
              </div>
              {generate > 0.05 && result < 0.94 && (
                <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(250,250,251,.76)', backdropFilter: 'blur(3px)', opacity: 1 - result}}>
                  <div style={{width: 74, height: 74, borderRadius: 22, display: 'grid', placeItems: 'center', background: `${COLORS.gold}22`, color: COLORS.gold, transform: `rotate(${frame * 2.5}deg)`}}><WandSparkles size={36} /></div>
                </div>
              )}
            </main>
          </div>
        </ProductWindow>
      </div>
    </SceneFrame>
  );
};
