import React from 'react';
import {Check, ChevronDown, Eye, MousePointer2, Rocket, Save, Sparkles} from 'lucide-react';
import {useCurrentFrame} from 'remotion';
import {COLORS, fadeWindow, mix, pop, reveal} from '../animations/timing';
import {ProductWindow} from '../components/ProductWindow';
import {SceneFrame} from '../components/SceneFrame';

export const EditorScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 240;
  const opacity = fadeWindow(frame, duration, 12, 16);
  const enter = reveal(frame, 0, 32);
  const edit = reveal(frame, 45, 36);
  const click = pop(frame, 139, 13);
  const published = reveal(frame, 151, 28);
  const cursorX = mix(frame, [80, 138], [1175, 1630]);
  const cursorY = mix(frame, [80, 138], [595, 194]);

  return (
    <SceneFrame opacity={opacity} showBrand={false}>
      <div style={{position: 'absolute', left: 70, top: 65, opacity: enter, transform: `scale(${0.95 + enter * 0.05}) translateY(${(1 - enter) * 30}px)`}}>
        <ProductWindow width={1780} height={950} title="Éditeur — Programme Indépendant" dark>
          <div style={{height: 66, display: 'flex', alignItems: 'center', padding: '0 18px', background: '#111722', borderBottom: '1px solid rgba(255,255,255,.08)', color: 'white'}}>
            <div style={{fontSize: 18, fontWeight: 800}}>Programme Indépendant</div>
            <span style={{marginLeft: 12, padding: '5px 9px', borderRadius: 99, background: published > 0.8 ? `${COLORS.green}22` : 'rgba(255,255,255,.06)', color: published > 0.8 ? '#5FBE8E' : '#94A3B8', fontSize: 11, fontWeight: 800}}>{published > 0.8 ? 'Publié' : 'Brouillon'}</span>
            <div style={{marginLeft: 30, fontSize: 11, color: '#64748B', fontFamily: 'monospace'}}>/tunnel/programme-independant</div>
            <div style={{marginLeft: 'auto', display: 'flex', gap: 9, alignItems: 'center'}}>
              <EditorButton><Save size={14} /> Enregistrer</EditorButton>
              <EditorButton><Eye size={14} /> Aperçu</EditorButton>
              <div
                style={{
                  height: 36,
                  padding: '0 15px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: published > 0.75 ? COLORS.green : 'linear-gradient(#6366F1,#4F46E5)',
                  boxShadow: published > 0.75 ? `0 0 30px ${COLORS.green}55` : '0 8px 20px rgba(79,70,229,.35)',
                  fontSize: 12,
                  fontWeight: 800,
                  transform: `scale(${1 - click * 0.045})`,
                }}
              >
                {published > 0.75 ? <Check size={15} /> : <Rocket size={15} />}
                {published > 0.75 ? 'En ligne' : 'Publier'}
              </div>
            </div>
          </div>

          <div style={{display: 'flex', height: 826}}>
            <aside style={{width: 285, background: '#0D111A', borderRight: '1px solid rgba(255,255,255,.08)', padding: 20, color: '#CBD5E1'}}>
              <div style={{fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 800}}>Pages du tunnel</div>
              {[
                ['Capture', 'Accueil'],
                ['Offre', 'Vente'],
                ['Merci', 'Confirmation'],
              ].map(([name, sub], i) => (
                <div key={name} style={{marginTop: 12, borderRadius: 10, padding: '13px 14px', background: i === 1 ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.035)', border: i === 1 ? '1px solid rgba(99,102,241,.36)' : '1px solid rgba(255,255,255,.04)'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 800}}><span style={{width: 7, height: 7, borderRadius: 99, background: i === 1 ? '#818CF8' : '#475569'}} />{name}</div>
                  <div style={{fontSize: 10, color: '#64748B', marginTop: 5, marginLeft: 16}}>{sub}</div>
                </div>
              ))}
              <div style={{marginTop: 26, fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 800}}>Sections</div>
              {['Hero', 'Problème', 'Bénéfices', 'Témoignages', 'Tarif', 'FAQ', 'CTA final'].map((name, i) => (
                <div key={name} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9, padding: '9px 10px', color: i === 0 ? 'white' : '#94A3B8', background: i === 0 ? 'rgba(255,255,255,.07)' : 'transparent', borderRadius: 8, fontSize: 12, fontWeight: i === 0 ? 800 : 600}}>
                  {name}<ChevronDown size={12} />
                </div>
              ))}
            </aside>

            <main style={{flex: 1, background: '#181D27', padding: 30, position: 'relative', overflow: 'hidden'}}>
              <div style={{width: 1170, height: 730, margin: '0 auto', background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,.38)', position: 'relative'}}>
                <div style={{height: '100%', padding: '78px 78px 40px', background: 'radial-gradient(circle at 80% 22%,rgba(8,73,141,.12),transparent 30%),linear-gradient(145deg,#F8FAFC,#FFFFFF)', color: COLORS.ink}}>
                  <div style={{display: 'inline-flex', borderRadius: 99, padding: '7px 11px', background: '#E8F1FB', color: COLORS.blue, fontSize: 11, fontWeight: 800}}>COACHING POUR INDÉPENDANTS</div>
                  <div style={{fontSize: 58, lineHeight: 1.03, letterSpacing: -2.8, fontWeight: 900, width: 700, marginTop: 22}}>
                    Structure ton offre.<br />Transforme ton expertise en <span style={{color: COLORS.blue, display: 'inline-block', transform: `translateY(${(1 - edit) * 8}px)`, opacity: 0.45 + edit * 0.55}}>système de vente.</span>
                  </div>
                  <div style={{marginTop: 22, width: 620, color: '#545B66', fontSize: 17, lineHeight: 1.55}}>Une méthode claire pour présenter ta valeur, attirer les bons prospects et convertir sans improviser chaque étape.</div>
                  <div style={{display: 'flex', gap: 12, marginTop: 28}}>
                    <div style={{height: 46, padding: '0 20px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9, background: COLORS.gold, color: COLORS.ink, fontSize: 14, fontWeight: 900}}>Découvrir le programme <Sparkles size={16} /></div>
                    <div style={{height: 46, padding: '0 18px', borderRadius: 10, display: 'flex', alignItems: 'center', border: '1px solid #DFE1E6', fontSize: 13, fontWeight: 700}}>Voir le parcours</div>
                  </div>
                  <div style={{position: 'absolute', right: 60, bottom: 58, width: 360, height: 190, borderRadius: 18, background: COLORS.navy, color: 'white', padding: 24, transform: `translateY(${mix(frame, [0, 240], [6, -6])}px)`, boxShadow: '0 30px 60px rgba(8,14,26,.26)'}}>
                    <div style={{fontSize: 11, color: COLORS.goldLight, fontWeight: 800, letterSpacing: 1}}>PARCOURS COMPLET</div>
                    <div style={{fontSize: 22, fontWeight: 800, marginTop: 10}}>Offre claire → demande qualifiée</div>
                    <div style={{display: 'flex', gap: 7, marginTop: 27}}>{['Message', 'Page', 'Suivi'].map((x) => <span key={x} style={{padding: '6px 9px', borderRadius: 7, background: 'rgba(255,255,255,.07)', color: '#CBD5E1', fontSize: 10, fontWeight: 700}}>{x}</span>)}</div>
                  </div>
                </div>
              </div>

              {published > 0.05 && (
                <div style={{position: 'absolute', left: '50%', top: '50%', width: 410, transform: `translate(-50%,-50%) scale(${0.86 + published * 0.14})`, opacity: published, background: '#0D1628', border: `1px solid ${COLORS.green}66`, borderRadius: 18, padding: 24, color: 'white', boxShadow: '0 30px 90px rgba(0,0,0,.5)'}}>
                  <div style={{display: 'flex', gap: 14, alignItems: 'center'}}>
                    <span style={{width: 48, height: 48, borderRadius: 14, display: 'grid', placeItems: 'center', background: `${COLORS.green}22`, color: '#5FBE8E'}}><Check size={25} /></span>
                    <div><div style={{fontSize: 18, fontWeight: 900}}>Tunnel publié</div><div style={{fontSize: 12, color: '#94A3B8', marginTop: 5}}>app.autofunnel.ai/tunnel/programme-independant</div></div>
                  </div>
                </div>
              )}
            </main>
          </div>

          <MousePointer2
            size={34}
            fill="white"
            style={{position: 'absolute', left: cursorX, top: cursorY, color: '#0F172A', filter: 'drop-shadow(0 4px 5px rgba(0,0,0,.35))', zIndex: 20}}
          />
        </ProductWindow>
      </div>

      <div style={{position: 'absolute', left: 132, bottom: 92, opacity: reveal(frame, 18, 28)}}>
        <div style={{fontSize: 17, fontWeight: 800, color: COLORS.goldLight, letterSpacing: 1.5, textTransform: 'uppercase'}}>Du brouillon à l'URL publique</div>
        <div style={{fontSize: 38, fontWeight: 800, letterSpacing: -1.5, marginTop: 9}}>Génère. Ajuste. Publie.</div>
      </div>
    </SceneFrame>
  );
};

const EditorButton: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{height: 36, padding: '0 13px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 7, border: '1px solid rgba(255,255,255,.10)', background: '#151920', color: '#CBD5E1', fontSize: 11, fontWeight: 700}}>{children}</div>
);
