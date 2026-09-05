"use client";

import { useEffect, useRef, useState } from "react";
import { Search, PenTool, Palette, Handshake, Package, Check, Pause, Play } from "lucide-react";
import styles from "./AgentWorkflowAnimation.module.css";

export const AGENT_WORKFLOW_COPY = {
  fr: { caption: "Le parcours de vos agents IA · illustration", title: "Une offre. Quatre expertises.", subtitle: "Chaque expertise prépare le prochain relais.", offer: "Ton offre", result: "Client acquis", note: "De la stratégie à la relation client", pause: "Mettre l’animation en pause", play: "Reprendre l’animation", actions: ["Structure du tunnel", "Accroches & CTA", "Pages mobile-first", "Capture · CRM · relances"] },
  en: { caption: "Your AI team’s workflow · illustration", title: "One offer. Four specialists.", subtitle: "Each specialist prepares the next handoff.", offer: "Your offer", result: "Customer acquired", note: "From strategy to customer relationships", pause: "Pause animation", play: "Resume animation", actions: ["Funnel structure", "Hooks & CTAs", "Mobile-first pages", "Capture · CRM · follow-up"] },
  es: { caption: "El recorrido de tus agentes IA · ilustración", title: "Una oferta. Cuatro especialidades.", subtitle: "Cada especialidad prepara el siguiente paso.", offer: "Tu oferta", result: "Cliente adquirido", note: "De la estrategia a la relación con el cliente", pause: "Pausar animación", play: "Reanudar animación", actions: ["Estructura del embudo", "Ganchos y CTA", "Páginas mobile-first", "Captura · CRM · seguimiento"] },
} as const;

type Member = { name: string; role: string; desc: string };
const ICONS = [Search, PenTool, Palette, Handshake];

/** Decorative outputs: structure, copy, page layout, then contact + email. */
function WorkArtifact({ index }: { index: number }) {
  return <svg viewBox="0 0 64 48" fill="none" aria-hidden="true" className={styles.artifact}>
    {index === 0 && <>
      <path d="M32 14v10H12v10m20-10h20v10" className={styles.artifactLine} />
      <rect x="23" y="3" width="18" height="11" rx="3" /><rect x="3" y="34" width="18" height="11" rx="3" /><rect x="43" y="34" width="18" height="11" rx="3" />
    </>}
    {index === 1 && <>
      <path d="M6 9h49M6 20h41M6 31h31" className={styles.copyLines} />
      <rect x="6" y="39" width="23" height="6" rx="3" />
    </>}
    {index === 2 && <>
      <rect x="5" y="3" width="43" height="42" rx="4" /><path d="M5 12h43" />
      <path d="M12 20h24v9H12zM12 35h10m6 0h8" className={styles.pageBlocks} />
      <rect x="42" y="22" width="17" height="24" rx="3" className={styles.phone} />
    </>}
    {index === 3 && <>
      <circle cx="17" cy="13" r="7" /><path d="M5 36v-3a12 12 0 0 1 24 0v3M31 24h7" />
      <g className={styles.envelope}><rect x="38" y="15" width="23" height="18" rx="3" /><path d="m39 17 10 8 11-8" /></g>
    </>}
  </svg>;
}

/** Names, roles and order come directly from the landing's existing team.members. */
export function AgentWorkflowAnimation({ language, members }: {
  language: keyof typeof AGENT_WORKFLOW_COPY;
  members: readonly Member[];
}) {
  const copy = AGENT_WORKFLOW_COPY[language];
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  return <section ref={root} className={styles.scene} data-paused={paused || !visible} aria-label={copy.title}>
    <div className={styles.ambient} aria-hidden="true" />
    <header className={styles.heading}>
      <div><h2>{copy.title}</h2><p>{copy.subtitle}</p></div>
      <button type="button" className={styles.pause} onClick={() => setPaused(value => !value)} aria-label={paused ? copy.play : copy.pause} aria-pressed={paused}>
        {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
      </button>
    </header>
    <div className={styles.endpoint}><Package size={15} aria-hidden="true" /><span>{copy.offer}</span><i aria-hidden="true" /></div>
    <div className={styles.production}>
      <svg className={styles.connections} viewBox="0 0 600 240" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <path d="M300 0H150V60H450V180H150V240H300" className={styles.wire} />
        <path d="M300 0H150V60H450V180H150V240H300" className={styles.litWire} />
        <circle r="4" className={styles.particle} /><circle r="9" className={`${styles.particle} ${styles.halo}`} />
      </svg>
      <ol className={styles.nodes}>
        {members.map((member, index) => {
          const Icon = ICONS[index] ?? Search;
          return <li className={styles.node} key={member.name}>
            <div className={styles.nodeGlow} aria-hidden="true" />
            <span className={styles.number} aria-hidden="true">0{index + 1}</span>
            <span className={styles.icon}><Icon size={22} aria-hidden="true" /></span>
            <div className={styles.identity}><h3>{member.name}</h3><p>{member.role}</p><small>{copy.actions[index]}</small></div>
            <WorkArtifact index={index} />
            <span className={styles.srOnly}>{member.desc}</span>
            <span className={styles.mobileRelay} aria-hidden="true"><i /></span>
          </li>;
        })}
      </ol>
    </div>
    <div className={`${styles.endpoint} ${styles.result}`}><Check size={16} aria-hidden="true" /><span>{copy.result}</span><i aria-hidden="true" /></div>
    <p className={styles.note}>{copy.note}</p>
  </section>;
}
