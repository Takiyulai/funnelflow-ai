"use client";

// Template bespoke — reproduction fidèle du design Claude Design (T4 Coach Service Light.dc.html).
// Contenu de démo par défaut. Animations (reveal/tilt/parallax/countdown/
// accordéon/marquee) câblées par FunnelSectionWrapper via les attributs data-*.

import type { Funnel } from "@/lib/funnels/types";
import { FunnelSectionWrapper } from "@/components/funnel/FunnelSectionWrapper";
import { bindTemplateData } from "./bind";

const HTML = `<style>@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap');
@keyframes af-shine{0%{transform:translateX(-160%) skewX(-18deg)}55%,100%{transform:translateX(360%) skewX(-18deg)}}
@keyframes hp-cta{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
[data-reveal]{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
[data-reveal].is-in{opacity:1;transform:none}
[data-acc-panel]{max-height:0;overflow:hidden;transition:max-height .4s ease}
.af-cta{position:relative;overflow:hidden;isolation:isolate;will-change:transform}
.af-cta::after{content:"";position:absolute;top:0;left:0;width:34%;height:100%;z-index:-1;background:linear-gradient(100deg,transparent,rgba(255,255,255,.4),transparent);animation:af-shine 3s ease-in-out infinite;pointer-events:none}

@container (max-width:880px){[data-grid=split]{grid-template-columns:1fr !important;gap:36px !important}[data-nav-links]{display:none !important}[data-hamburger]{display:inline-flex !important}[data-h1]{font-size:34px !important}[data-cols]{grid-template-columns:1fr !important}}</style>
<div style="min-height:100vh;background:#F8F9FA;color:#333333;font-family:'DM Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased">

  <!-- template hint strip -->
  

  <!-- NAV -->
  <nav style="background:#fff;border-bottom:1px solid #E5E7EB"><div style="max-width:1120px;margin:0 auto;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px">
    <div style="font-family:'Fraunces',serif;font-weight:600;font-size:22px;color:#1D4A4A;letter-spacing:-.01em">AutoFunnel<span style="font-style:italic"> AI</span></div>
    <a href="#appel" class="af-cta" style="padding:12px 24px;border-radius:8px;background:#1D4A4A;color:#fff;font-weight:600;font-size:14.5px;text-decoration:none">Réserver un appel</a>
    <button data-hamburger style="display:none;background:none;border:1px solid #CBD2D9;color:#1D4A4A;border-radius:8px;padding:8px 11px;font-size:16px;cursor:pointer">☰</button>
  </div></nav>

  <!-- HERO -->
  <header style="background:#fff"><div data-grid="split" style="max-width:1120px;margin:0 auto;padding:80px 24px;display:grid;grid-template-columns:1.1fr .9fr;gap:56px;align-items:center">
    <div>
      
      <div data-reveal style="display:inline-block;padding:7px 16px;border-radius:8px;background:#E6F0F0;color:#1D4A4A;font-size:13.5px;font-weight:600;margin-bottom:24px">Accompagnement · 1 place ouverte ce mois-ci</div>
      <h1 data-h1 data-reveal data-delay="80" style="font-family:'Fraunces',serif;font-size:46px;line-height:1.12;font-weight:600;color:#1D4A4A;margin:0 0 20px;letter-spacing:-.01em">Construisez le tunnel qui remplit votre agenda</h1>
      <p data-reveal data-delay="160" style="font-size:18px;line-height:1.65;color:#4B5563;margin:0 0 30px">Un accompagnement individuel pour transformer votre expertise en un système de clients réguliers — clair, humain, et durable.</p>
      <div data-reveal data-delay="240" style="display:flex;flex-wrap:wrap;align-items:center;gap:22px">
        <a href="#appel" class="af-cta" style="padding:15px 30px;border-radius:8px;background:#1D4A4A;color:#fff;font-weight:600;font-size:16px;text-decoration:none;animation:hp-cta 3.6s ease-in-out infinite">Réserver un appel découverte&nbsp;⟶</a>
      </div>
    </div>
    <div data-reveal data-delay="120" style="display:flex;justify-content:center">
      <div style="width:300px;height:360px;border-radius:14px;background:#E6F0F0;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">
        <div style="width:150px;height:150px;border-radius:50%;background:#1D4A4A;color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:52px">C</div>
        <div style="position:absolute;bottom:20px;left:20px;right:20px;background:#fff;border-radius:10px;padding:14px 16px;box-shadow:0 4px 16px rgba(29,74,74,.1)"><div style="font-weight:600;color:#1D4A4A;font-size:15px">Camille Fontaine</div><div style="font-size:13px;color:#6B7280">Coach business · 8 ans d'expérience</div></div>
      </div>
    </div>
  </div></header>

  <!-- SPECIALITES -->
  <section style="background:#F8F9FA"><div style="max-width:1120px;margin:0 auto;padding:72px 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:20px"><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#1D4A4A;font-weight:700">Domaines d'accompagnement</div></div>
    <div data-reveal data-delay="80" style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px">
      <span style="padding:11px 20px;border-radius:8px;background:#E6F0F0;color:#1D4A4A;font-size:15px;font-weight:600">Stratégie d'offre</span>
      <span style="padding:11px 20px;border-radius:8px;background:#E6F0F0;color:#1D4A4A;font-size:15px;font-weight:600">Tunnel de vente</span>
      <span style="padding:11px 20px;border-radius:8px;background:#E6F0F0;color:#1D4A4A;font-size:15px;font-weight:600">Copywriting</span>
      <span style="padding:11px 20px;border-radius:8px;background:#E6F0F0;color:#1D4A4A;font-size:15px;font-weight:600">Emailing</span>
      <span style="padding:11px 20px;border-radius:8px;background:#E6F0F0;color:#1D4A4A;font-size:15px;font-weight:600">Positionnement</span>
      <span style="padding:11px 20px;border-radius:8px;background:#E6F0F0;color:#1D4A4A;font-size:15px;font-weight:600">Automatisation</span>
    </div>
  </div></section>

  <!-- METHODE -->
  <section id="methode" style="background:#fff"><div style="max-width:1120px;margin:0 auto;padding:80px 24px">
    
    <div data-reveal style="margin-bottom:12px"><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#1D4A4A;font-weight:700;margin-bottom:12px">La méthode</div><h2 style="font-family:'Fraunces',serif;font-size:36px;font-weight:600;color:#1D4A4A;margin:0;max-width:560px">Trois temps pour un système qui tient dans la durée</h2></div>
    <div style="margin-top:40px">
      <div data-reveal style="display:grid;grid-template-columns:60px 1fr;gap:24px;padding:28px 0;border-top:1px solid #E5E7EB"><div style="font-family:'Fraunces',serif;font-size:28px;color:#1D4A4A">01</div><div><h3 style="font-size:20px;font-weight:600;color:#1D4A4A;margin:0 0 8px">Clarifier votre offre</h3><p style="font-size:15.5px;line-height:1.7;color:#4B5563;margin:0;max-width:640px">On définit ensemble une promesse forte, un client idéal et un prix juste — la fondation de tout le reste.</p></div></div>
      <div data-reveal style="display:grid;grid-template-columns:60px 1fr;gap:24px;padding:28px 0;border-top:1px solid #E5E7EB"><div style="font-family:'Fraunces',serif;font-size:28px;color:#1D4A4A">02</div><div><h3 style="font-size:20px;font-weight:600;color:#1D4A4A;margin:0 0 8px">Construire le tunnel</h3><p style="font-size:15.5px;line-height:1.7;color:#4B5563;margin:0;max-width:640px">Pages, séquences email et prise de rendez-vous, assemblées avec AutoFunnel AI et adaptées à votre voix.</p></div></div>
      <div data-reveal style="display:grid;grid-template-columns:60px 1fr;gap:24px;padding:28px 0;border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB"><div style="font-family:'Fraunces',serif;font-size:28px;color:#1D4A4A">03</div><div><h3 style="font-size:20px;font-weight:600;color:#1D4A4A;margin:0 0 8px">Installer la régularité</h3><p style="font-size:15.5px;line-height:1.7;color:#4B5563;margin:0;max-width:640px">On met en place le rythme de contenu et de relance qui remplit votre agenda mois après mois.</p></div></div>
    </div>
  </div></section>

  <!-- FORMATION / EXPERIENCE (fond clair teal) -->
  <section style="background:#E6F0F0"><div style="max-width:1120px;margin:0 auto;padding:80px 24px">
    
    <div data-grid="split" style="display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center">
      <div data-reveal><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#1D4A4A;font-weight:700;margin-bottom:14px">Parcours</div><h2 style="font-family:'Fraunces',serif;font-size:32px;font-weight:600;color:#1D4A4A;margin:0 0 18px">Une expertise éprouvée sur le terrain</h2><p style="font-size:16px;line-height:1.7;color:#3B4A4A;margin:0 0 16px">Huit ans à accompagner coachs, thérapeutes et consultants dans la construction de leur activité en ligne — sans jargon, sans promesses creuses.</p><p style="font-size:16px;line-height:1.7;color:#3B4A4A;margin:0">Plus de 120 accompagnements individuels, une méthode affinée client après client.</p></div>
      <div data-reveal data-delay="120" style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
        <div style="background:#fff;border-radius:12px;padding:26px"><div style="font-family:'Fraunces',serif;font-size:34px;color:#1D4A4A;margin-bottom:6px">120+</div><div style="font-size:14px;color:#4B5563">accompagnements individuels</div></div>
        <div style="background:#fff;border-radius:12px;padding:26px"><div style="font-family:'Fraunces',serif;font-size:34px;color:#1D4A4A;margin-bottom:6px">8 ans</div><div style="font-size:14px;color:#4B5563">d'expérience terrain</div></div>
        <div style="background:#fff;border-radius:12px;padding:26px"><div style="font-family:'Fraunces',serif;font-size:34px;color:#1D4A4A;margin-bottom:6px">94 %</div><div style="font-size:14px;color:#4B5563">de clients qui recommandent</div></div>
        <div style="background:#fff;border-radius:12px;padding:26px"><div style="font-family:'Fraunces',serif;font-size:34px;color:#1D4A4A;margin-bottom:6px">1:1</div><div style="font-size:14px;color:#4B5563">un suivi entièrement personnel</div></div>
      </div>
    </div>
  </div></section>

  <!-- TEMOIGNAGE -->
  <section style="background:#fff"><div style="max-width:820px;margin:0 auto;padding:80px 24px;text-align:center">
    
    <blockquote data-reveal style="font-family:'Fraunces',serif;margin:0 0 26px;font-size:26px;line-height:1.5;font-weight:500;color:#1D4A4A">« En trois mois, mon agenda est passé de vide à complet. Camille m'a donné une méthode que je peux répéter seule, encore et encore. »</blockquote>
    <div data-reveal data-delay="120" style="display:flex;align-items:center;justify-content:center;gap:13px"><span style="width:48px;height:48px;border-radius:50%;background:#1D4A4A;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:16px">AL</span><span style="text-align:left"><b style="display:block;color:#1D4A4A;font-size:15.5px">Aline Lefebvre</b><span style="font-size:13.5px;color:#6B7280">Thérapeute · Lyon</span></span></div>
  </div></section>

  <!-- FAQ -->
  <section id="faq" style="background:#F8F9FA"><div style="max-width:800px;margin:0 auto;padding:80px 24px">
    <div data-reveal style="text-align:center;margin-bottom:40px"><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#1D4A4A;font-weight:700;margin-bottom:12px">Questions</div><h2 style="font-family:'Fraunces',serif;font-size:32px;font-weight:600;color:#1D4A4A;margin:0">Ce qu'on me demande souvent</h2></div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div data-faq-item data-reveal style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#1D4A4A;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Combien de temps dure l'accompagnement ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#1D4A4A">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#4B5563;font-size:15px;line-height:1.65">Trois mois, avec un point individuel chaque semaine et un accès continu entre les séances.</p></div></div>
      <div data-faq-item data-reveal style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#1D4A4A;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Faut-il déjà avoir des clients ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#1D4A4A">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#4B5563;font-size:15px;line-height:1.65">Non. On travaille aussi bien un lancement d'activité qu'une remise à plat d'une offre existante.</p></div></div>
      <div data-faq-item data-reveal style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#1D4A4A;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Comment se passe l'appel découverte ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#1D4A4A">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#4B5563;font-size:15px;line-height:1.65">Trente minutes, gratuites et sans engagement, pour voir si nous sommes faits pour travailler ensemble.</p></div></div>
    </div>
  </div></section>

  <!-- CTA / APPEL -->
  <section id="appel" style="background:#1D4A4A"><div style="max-width:720px;margin:0 auto;padding:80px 24px;text-align:center">
    <h2 data-reveal style="font-family:'Fraunces',serif;font-size:38px;font-weight:600;color:#fff;margin:0 0 14px">Parlons de votre projet</h2>
    <p data-reveal data-delay="80" style="font-size:17px;color:#BFE3DD;margin:0 0 30px">Un appel de 30 minutes pour clarifier votre situation et vos prochaines étapes. Sans engagement.</p>
    <a href="#" data-reveal data-delay="160" class="af-cta" style="display:inline-block;padding:16px 34px;border-radius:8px;background:#fff;color:#1D4A4A;font-weight:700;font-size:16px;text-decoration:none">Réserver mon appel découverte&nbsp;⟶</a>
  </div></section>

  <!-- FOOTER -->
  <footer style="background:#fff;border-top:1px solid #E5E7EB"><div style="max-width:1120px;margin:0 auto;padding:34px 24px;display:flex;flex-wrap:wrap;gap:22px;align-items:center;justify-content:space-between">
    <div style="font-family:'Fraunces',serif;font-weight:600;font-size:18px;color:#1D4A4A">AutoFunnel<span style="font-style:italic"> AI</span></div>
    <div style="display:flex;gap:24px;font-size:14px;color:#6B7280"><a href="#" style="text-decoration:none">Mentions légales</a><a href="#" style="text-decoration:none">Confidentialité</a><a href="#" style="text-decoration:none">Contact</a></div>
    <div style="font-size:13px;color:#9CA3AF">© 2026 AutoFunnel AI</div>
  </div></footer>

</div>`;

export function CoachServiceLight(props: { funnel?: Funnel }) {
  return (
    <FunnelSectionWrapper>
      <div dangerouslySetInnerHTML={{ __html: bindTemplateData(HTML, props.funnel) }} />
    </FunnelSectionWrapper>
  );
}

export default CoachServiceLight;
