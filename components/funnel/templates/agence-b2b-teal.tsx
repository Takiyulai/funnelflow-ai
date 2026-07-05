"use client";

// Template bespoke — reproduction fidèle du design Claude Design (T6 Agence B2B Teal.dc.html).
// Contenu de démo par défaut. Animations (reveal/tilt/parallax/countdown/
// accordéon/marquee) câblées par FunnelSectionWrapper via les attributs data-*.

import type { Funnel } from "@/lib/funnels/types";
import { FunnelSectionWrapper } from "@/components/funnel/FunnelSectionWrapper";
import { bindTemplateData } from "./bind";

const HTML = `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes af-shine{0%{transform:translateX(-160%) skewX(-18deg)}55%,100%{transform:translateX(360%) skewX(-18deg)}}
@keyframes hp-cta{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
[data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
[data-reveal].is-in{opacity:1;transform:none}
[data-acc-panel]{max-height:0;overflow:hidden;transition:max-height .4s ease}
[data-count]{font-variant-numeric:tabular-nums}
.af-cta{position:relative;overflow:hidden;isolation:isolate;will-change:transform}
.af-cta::after{content:"";position:absolute;top:0;left:0;width:34%;height:100%;z-index:-1;background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);animation:af-shine 3s ease-in-out infinite;pointer-events:none}

@container (max-width:880px){[data-grid=split]{grid-template-columns:1fr !important;gap:40px !important}[data-nav-links]{display:none !important}[data-hamburger]{display:inline-flex !important}[data-h1]{font-size:34px !important}[data-cols]{grid-template-columns:1fr !important}[data-stats]{grid-template-columns:1fr 1fr !important}}</style>
<div style="min-height:100vh;background:#fff;color:#1F2937;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased">

  <!-- template hint strip -->
  

  <!-- NAV -->
  <nav style="background:#fff;border-bottom:1px solid #EEF1F5"><div style="max-width:1140px;margin:0 auto;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px">
    <div style="font-weight:800;font-size:20px;color:#0D9488;letter-spacing:-.03em;text-transform:lowercase">autofunnel<span style="color:#1F2937">.ai</span></div>
    <a href="#contact" class="af-cta" style="padding:11px 22px;border-radius:8px;background:#0D9488;color:#fff;font-weight:600;font-size:14.5px;text-decoration:none">Prendre rendez-vous</a>
    <button data-hamburger style="display:none;background:none;border:1px solid #D1D5DB;color:#0D9488;border-radius:8px;padding:8px 11px;font-size:16px;cursor:pointer">☰</button>
  </div></nav>

  <!-- HERO -->
  <header style="background:#fff"><div style="max-width:900px;margin:0 auto;padding:88px 24px 64px">
    
    <div data-reveal style="display:inline-block;padding:7px 16px;border-radius:8px;background:#E7F6F4;color:#0D7A70;font-size:13px;font-weight:600;margin-bottom:24px">Agence de tunnels de vente · B2B</div>
    <h1 data-h1 data-reveal data-delay="80" style="font-size:44px;line-height:1.14;font-weight:700;letter-spacing:-.02em;color:#1F2937;margin:0 0 22px;max-width:760px">Nous construisons les <span style="color:#0D9488">tunnels d'acquisition</span> qui font grandir les entreprises exigeantes</h1>
    <p data-reveal data-delay="160" style="font-size:18px;line-height:1.65;color:#4B5563;margin:0 0 30px;max-width:620px">De la stratégie à la mise en ligne, nous concevons des systèmes de génération de leads mesurables, pilotés par l'IA d'AutoFunnel.</p>
    <div data-reveal data-delay="240" style="display:flex;flex-wrap:wrap;align-items:center;gap:20px">
      <a href="#contact" class="af-cta" style="padding:15px 30px;border-radius:8px;background:#0D9488;color:#fff;font-weight:600;font-size:16px;text-decoration:none;animation:hp-cta 3.6s ease-in-out infinite">Discuter de votre projet&nbsp;»</a>
    </div>
  </div></header>

  <!-- METHODOLOGIE -->
  <section id="methode" style="background:#F9FAFB"><div style="max-width:1140px;margin:0 auto;padding:80px 24px">
    
    <div data-reveal style="margin-bottom:44px"><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0D9488;font-weight:700;margin-bottom:12px">Notre méthode</div><h2 style="font-size:34px;font-weight:700;letter-spacing:-.02em;color:#1F2937;margin:0;max-width:560px">Un processus éprouvé, du diagnostic au résultat</h2></div>
    <div data-cols style="display:grid;grid-template-columns:repeat(4,1fr);gap:22px">
      <div data-reveal style="padding-top:6px"><div style="width:44px;height:44px;border-radius:10px;background:#E7F6F4;display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div><h3 style="font-size:17px;font-weight:700;color:#1F2937;margin:0 0 8px">01 · Diagnostic</h3><p style="font-size:14.5px;line-height:1.6;color:#4B5563;margin:0">On analyse votre acquisition actuelle et vos points de fuite.</p></div>
      <div data-reveal data-delay="80" style="padding-top:6px"><div style="width:44px;height:44px;border-radius:10px;background:#E7F6F4;display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></div><h3 style="font-size:17px;font-weight:700;color:#1F2937;margin:0 0 8px">02 · Conception</h3><p style="font-size:14.5px;line-height:1.6;color:#4B5563;margin:0">On dessine le tunnel, les messages et les séquences d'emails.</p></div>
      <div data-reveal data-delay="160" style="padding-top:6px"><div style="width:44px;height:44px;border-radius:10px;background:#E7F6F4;display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></div><h3 style="font-size:17px;font-weight:700;color:#1F2937;margin:0 0 8px">03 · Déploiement</h3><p style="font-size:14.5px;line-height:1.6;color:#4B5563;margin:0">On met en ligne, on connecte vos outils et on lance le trafic.</p></div>
      <div data-reveal data-delay="240" style="padding-top:6px"><div style="width:44px;height:44px;border-radius:10px;background:#E7F6F4;display:flex;align-items:center;justify-content:center;margin-bottom:16px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></div><h3 style="font-size:17px;font-weight:700;color:#1F2937;margin:0 0 8px">04 · Optimisation</h3><p style="font-size:14.5px;line-height:1.6;color:#4B5563;margin:0">On mesure chaque étape et on améliore en continu.</p></div>
    </div>
  </div></section>

  <!-- RESULTATS / STATS -->
  <section id="resultats" style="background:#F9FAFB;border-top:1px solid #EEF1F5"><div style="max-width:1140px;margin:0 auto;padding:80px 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:52px"><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0D9488;font-weight:700;margin-bottom:12px">Nos résultats</div><h2 style="font-size:34px;font-weight:700;letter-spacing:-.02em;color:#1F2937;margin:0">Des chiffres, pas des promesses</h2></div>
    <div data-stats data-reveal data-delay="80" style="display:grid;grid-template-columns:repeat(4,1fr);gap:28px;text-align:center">
      <div><div data-count data-to="25" data-prefix="+" style="font-size:64px;font-weight:800;color:#F59E0B;line-height:1;letter-spacing:-.03em">+25</div><div style="font-size:14.5px;color:#4B5563;margin-top:10px">clients accompagnés</div></div>
      <div><div data-count data-to="100" data-prefix="+" data-suffix="K" style="font-size:64px;font-weight:800;color:#F59E0B;line-height:1;letter-spacing:-.03em">+100K</div><div style="font-size:14.5px;color:#4B5563;margin-top:10px">leads générés</div></div>
      <div><div data-count data-to="1" data-prefix="+" data-suffix="M€" style="font-size:64px;font-weight:800;color:#F59E0B;line-height:1;letter-spacing:-.03em">+1M€</div><div style="font-size:14.5px;color:#4B5563;margin-top:10px">de revenus attribués</div></div>
      <div><div data-count data-to="98" data-suffix="%" style="font-size:64px;font-weight:800;color:#F59E0B;line-height:1;letter-spacing:-.03em">98%</div><div style="font-size:14.5px;color:#4B5563;margin-top:10px">de clients fidélisés</div></div>
    </div>
  </div></section>

  <!-- TEMOIGNAGE -->
  <section style="background:#fff"><div style="max-width:860px;margin:0 auto;padding:80px 24px;text-align:center">
    <blockquote data-reveal style="margin:0 0 26px;font-size:24px;line-height:1.55;font-weight:500;color:#1F2937">« En deux trimestres, notre coût d'acquisition a baissé de 40 % et notre pipeline n'a jamais été aussi rempli. Une équipe qui parle chiffres, pas jargon. »</blockquote>
    <div data-reveal data-delay="120" style="display:flex;align-items:center;justify-content:center;gap:13px"><span style="width:48px;height:48px;border-radius:50%;background:#0D9488;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px">MR</span><span style="text-align:left"><b style="display:block;color:#1F2937;font-size:15.5px">Marc Rousseau</b><span style="font-size:13.5px;color:#6B7280">Directeur commercial · Praxio</span></span></div>
  </div></section>

  <!-- SERVICES -->
  <section id="services" style="background:#F9FAFB;border-top:1px solid #EEF1F5"><div style="max-width:1140px;margin:0 auto;padding:80px 24px">
    
    <div data-grid="split" style="display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:start">
      <div data-reveal><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0D9488;font-weight:700;margin-bottom:14px">Nos services</div><h2 style="font-size:32px;font-weight:700;letter-spacing:-.02em;color:#1F2937;margin:0 0 16px">Une offre complète, sans zone d'ombre</h2><p style="font-size:16px;line-height:1.7;color:#4B5563;margin:0">Chaque mission couvre l'ensemble de la chaîne d'acquisition, avec un interlocuteur unique et un reporting transparent.</p></div>
      <ul data-reveal data-delay="120" style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:2px">
        <li style="display:flex;gap:14px;padding:18px 0;border-bottom:1px solid #E5E7EB"><span style="flex:none;width:8px;height:8px;border-radius:50%;background:#0D9488;margin-top:8px"></span><div><b style="color:#1F2937;font-size:16px">Audit &amp; stratégie d'acquisition</b><p style="margin:4px 0 0;font-size:14.5px;color:#6B7280;line-height:1.55">Cartographie complète de votre entonnoir et plan d'action priorisé.</p></div></li>
        <li style="display:flex;gap:14px;padding:18px 0;border-bottom:1px solid #E5E7EB"><span style="flex:none;width:8px;height:8px;border-radius:50%;background:#0D9488;margin-top:8px"></span><div><b style="color:#1F2937;font-size:16px">Conception de tunnels</b><p style="margin:4px 0 0;font-size:14.5px;color:#6B7280;line-height:1.55">Pages, formulaires et séquences email générés et optimisés par IA.</p></div></li>
        <li style="display:flex;gap:14px;padding:18px 0;border-bottom:1px solid #E5E7EB"><span style="flex:none;width:8px;height:8px;border-radius:50%;background:#0D9488;margin-top:8px"></span><div><b style="color:#1F2937;font-size:16px">Automatisation &amp; CRM</b><p style="margin:4px 0 0;font-size:14.5px;color:#6B7280;line-height:1.55">Connexion de vos outils et scénarios de nurturing automatiques.</p></div></li>
        <li style="display:flex;gap:14px;padding:18px 0"><span style="flex:none;width:8px;height:8px;border-radius:50%;background:#0D9488;margin-top:8px"></span><div><b style="color:#1F2937;font-size:16px">Reporting &amp; optimisation</b><p style="margin:4px 0 0;font-size:14.5px;color:#6B7280;line-height:1.55">Tableaux de bord mensuels et itérations sur les points faibles.</p></div></li>
      </ul>
    </div>
  </div></section>

  <!-- FAQ -->
  <section id="faq" style="background:#fff"><div style="max-width:800px;margin:0 auto;padding:80px 24px">
    <div data-reveal style="text-align:center;margin-bottom:40px"><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0D9488;font-weight:700;margin-bottom:12px">Questions</div><h2 style="font-size:32px;font-weight:700;letter-spacing:-.02em;color:#1F2937;margin:0">Ce que demandent nos clients</h2></div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div data-faq-item data-reveal style="background:#F9FAFB;border:1px solid #EEF1F5;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#1F2937;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Sous combien de temps voit-on des résultats ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#0D9488">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#6B7280;font-size:15px;line-height:1.65">Les premiers leads qualifiés arrivent généralement dans les 4 à 6 semaines suivant la mise en ligne.</p></div></div>
      <div data-faq-item data-reveal style="background:#F9FAFB;border:1px solid #EEF1F5;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#1F2937;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Travaillez-vous avec notre CRM existant ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#0D9488">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#6B7280;font-size:15px;line-height:1.65">Oui, nous nous connectons aux principaux CRM du marché et à vos outils internes.</p></div></div>
      <div data-faq-item data-reveal style="background:#F9FAFB;border:1px solid #EEF1F5;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#1F2937;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Quel est le format d'engagement ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#0D9488">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#6B7280;font-size:15px;line-height:1.65">Une mission de cadrage ponctuelle, puis un accompagnement mensuel sans engagement de longue durée.</p></div></div>
    </div>
  </div></section>

  <!-- CTA / CONTACT -->
  <section id="contact" style="background:#0D9488"><div style="max-width:720px;margin:0 auto;padding:80px 24px;text-align:center">
    <h2 data-reveal style="font-size:36px;font-weight:700;letter-spacing:-.02em;color:#fff;margin:0 0 14px">Parlons de votre acquisition</h2>
    <p data-reveal data-delay="80" style="font-size:17px;color:#CFF3EF;margin:0 0 30px">Un premier échange de 30 minutes pour cadrer vos objectifs et estimer le potentiel.</p>
    <a href="#" data-reveal data-delay="160" class="af-cta" style="display:inline-block;padding:16px 34px;border-radius:8px;background:#fff;color:#0D7A70;font-weight:700;font-size:16px;text-decoration:none">Prendre rendez-vous&nbsp;»</a>
  </div></section>

  <!-- FOOTER -->
  <footer style="background:#fff;border-top:1px solid #EEF1F5"><div style="max-width:1140px;margin:0 auto;padding:34px 24px;display:flex;flex-wrap:wrap;gap:22px;align-items:center;justify-content:space-between">
    <div style="font-weight:800;font-size:18px;color:#0D9488;letter-spacing:-.03em;text-transform:lowercase">autofunnel<span style="color:#1F2937">.ai</span></div>
    <div style="display:flex;gap:24px;font-size:14px;color:#0D9488"><a href="#" style="text-decoration:none">LinkedIn</a><a href="#" style="text-decoration:none">Mentions légales</a><a href="#" style="text-decoration:none">Contact</a></div>
    <div style="font-size:13px;color:#9CA3AF">© 2026 AutoFunnel AI</div>
  </div></footer>

</div>`;

export function AgenceB2bTeal(props: { funnel?: Funnel }) {
  return (
    <FunnelSectionWrapper>
      <div dangerouslySetInnerHTML={{ __html: bindTemplateData(HTML, props.funnel) }} />
    </FunnelSectionWrapper>
  );
}

export default AgenceB2bTeal;
