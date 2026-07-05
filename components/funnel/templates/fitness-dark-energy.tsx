"use client";

// Template bespoke — reproduction fidèle du design Claude Design (T7 Fitness Dark Energy.dc.html).
// Contenu de démo par défaut. Animations (reveal/tilt/parallax/countdown/
// accordéon/marquee) câblées par FunnelSectionWrapper via les attributs data-*.

import type { Funnel } from "@/lib/funnels/types";
import { FunnelSectionWrapper } from "@/components/funnel/FunnelSectionWrapper";
import { bindTemplateData } from "./bind";

const HTML = `<style>@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap');
@keyframes af-shine{0%{transform:translateX(-160%) skewX(-18deg)}55%,100%{transform:translateX(360%) skewX(-18deg)}}
@keyframes hp-cta{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes hp-badge-float{0%,100%{transform:translateY(0) rotate(-8deg)}50%{transform:translateY(-8px) rotate(-8deg)}}
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
[data-reveal]{opacity:0;transform:translateY(26px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
[data-reveal].is-in{opacity:1;transform:none}
[data-acc-panel]{max-height:0;overflow:hidden;transition:max-height .4s ease}
[data-tilt-inner]{transition:transform .18s ease}
.bebas{font-family:'Bebas Neue',sans-serif;font-weight:400}
.af-cta{position:relative;overflow:hidden;isolation:isolate;will-change:transform}
.af-cta::after{content:"";position:absolute;top:0;left:0;width:34%;height:100%;z-index:-1;background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);animation:af-shine 2.6s ease-in-out infinite;pointer-events:none}

@container (max-width:880px){[data-nav-links]{display:none !important}[data-hamburger]{display:inline-flex !important}[data-h1]{font-size:52px !important}[data-cols]{grid-template-columns:1fr !important}[data-price]{grid-template-columns:1fr !important}}</style>
<div style="min-height:100vh;background:#fff;color:#111111;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased">

  <!-- template hint strip -->
  

  <!-- NAV -->
  <nav style="background:#fff;border-bottom:2px solid #000"><div style="max-width:1160px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px">
    <div class="bebas" style="font-size:30px;letter-spacing:.04em;color:#000">FITNESS<span style="color:#EF4444">ZONE</span></div>
    <a href="#prix" class="af-cta" style="padding:12px 24px;border-radius:4px;background:#000;color:#fff;font-weight:700;font-size:13.5px;text-decoration:none;text-transform:uppercase;letter-spacing:.05em">Je m'inscris</a>
    <button data-hamburger style="display:none;background:none;border:2px solid #000;color:#000;border-radius:6px;padding:7px 10px;font-size:16px;cursor:pointer">☰</button>
  </div></nav>

  <!-- HERO -->
  <header style="background:#fff"><div style="max-width:1000px;margin:0 auto;padding:76px 24px 48px;text-align:center;position:relative">
    
    <div data-reveal style="display:inline-block;padding:8px 18px;border-radius:4px;background:#000;color:#FACC15;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:26px">Nouveau programme · 8 semaines</div>
    <h1 data-h1 data-reveal data-delay="80" class="bebas" style="font-size:76px;line-height:.94;letter-spacing:.04em;text-transform:uppercase;margin:0 0 22px;color:#000">Transforme ton corps.<br><span style="color:#EF4444">Domine</span> ton <span style="color:#F97316">mental.</span></h1>
    <p data-reveal data-delay="160" style="font-size:19px;line-height:1.6;color:#4B4B4B;max-width:560px;margin:0 auto 32px">Un programme d'entraînement et de nutrition livré via un tunnel AutoFunnel AI — coaching, suivi et communauté, tout au même endroit.</p>
    <div data-reveal data-delay="240" style="display:flex;flex-direction:column;align-items:center;gap:14px">
      <a href="#prix" class="af-cta" style="padding:18px 42px;border-radius:4px;background:linear-gradient(100deg,#EF4444,#F97316);color:#fff;font-weight:700;font-size:17px;text-decoration:none;text-transform:uppercase;letter-spacing:.05em;box-shadow:0 14px 34px rgba(239,68,68,.35);animation:hp-cta 3s ease-in-out infinite">Commencer le défi&nbsp;➤</a>
      <div style="font-size:13.5px;color:#6B6B6B;text-transform:uppercase;letter-spacing:.04em">Sans matériel · À la maison ou en salle</div>
    </div>
    <div style="position:absolute;top:60px;right:calc(50% - 480px);width:96px;height:96px;border-radius:50%;background:#EF4444;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;animation:hp-badge-float 4.5s ease-in-out infinite;box-shadow:0 10px 26px rgba(239,68,68,.4)"><span class="bebas" style="font-size:26px;line-height:.9">-30%</span><span style="font-size:9px;font-weight:700;letter-spacing:.06em">CE MOIS</span></div>
  </div></header>

  <!-- MARQUEE -->
  <div style="background:#000;overflow:hidden;white-space:nowrap;padding:16px 0;border-top:2px solid #EF4444;border-bottom:2px solid #EF4444">
    <div data-marquee style="display:inline-block;white-space:nowrap;will-change:transform"><span class="bebas" style="font-size:26px;letter-spacing:.08em;color:#fff">FITNESS ZONE&nbsp;&nbsp;<span style="color:#FACC15">✦</span>&nbsp;&nbsp;AUTOFUNNEL AI&nbsp;&nbsp;<span style="color:#EF4444">✦</span>&nbsp;&nbsp;GÉNÈRE&nbsp;&nbsp;<span style="color:#F97316">✦</span>&nbsp;&nbsp;VENDS&nbsp;&nbsp;<span style="color:#FACC15">✦</span>&nbsp;&nbsp;DOMINE&nbsp;&nbsp;<span style="color:#EF4444">✦</span>&nbsp;&nbsp;FITNESS ZONE&nbsp;&nbsp;<span style="color:#FACC15">✦</span>&nbsp;&nbsp;AUTOFUNNEL AI&nbsp;&nbsp;<span style="color:#EF4444">✦</span>&nbsp;&nbsp;GÉNÈRE&nbsp;&nbsp;<span style="color:#F97316">✦</span>&nbsp;&nbsp;VENDS&nbsp;&nbsp;<span style="color:#FACC15">✦</span>&nbsp;&nbsp;DOMINE&nbsp;&nbsp;<span style="color:#EF4444">✦</span>&nbsp;&nbsp;</span></div>
  </div>

  <!-- FEATURES / PROGRAMME -->
  <section id="programme" style="background:#fff"><div style="max-width:1160px;margin:0 auto;padding:84px 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:52px"><div style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#EF4444;font-weight:700;margin-bottom:10px">Ce que tu obtiens</div><h2 class="bebas" style="font-size:52px;letter-spacing:.03em;text-transform:uppercase;color:#000;margin:0">Le programme complet</h2></div>
    <div data-cols style="display:grid;grid-template-columns:repeat(3,1fr);gap:22px">
      <div data-reveal style="border:2px solid #000;border-radius:8px;padding:30px"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:16px"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg><h3 class="bebas" style="font-size:26px;letter-spacing:.03em;text-transform:uppercase;color:#000;margin:0 0 8px">48 séances guidées</h3><p style="font-size:14.5px;line-height:1.6;color:#4B4B4B;margin:0">Un plan progressif sur 8 semaines, en vidéo, adapté à ton niveau.</p></div>
      <div data-reveal data-delay="80" style="border:2px solid #000;border-radius:8px;padding:30px"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:16px"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg><h3 class="bebas" style="font-size:26px;letter-spacing:.03em;text-transform:uppercase;color:#000;margin:0 0 8px">Plan nutrition</h3><p style="font-size:14.5px;line-height:1.6;color:#4B4B4B;margin:0">Menus, listes de courses et recettes calibrés sur ton objectif.</p></div>
      <div data-reveal data-delay="160" style="border:2px solid #000;border-radius:8px;padding:30px"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:16px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><h3 class="bebas" style="font-size:26px;letter-spacing:.03em;text-transform:uppercase;color:#000;margin:0 0 8px">Communauté privée</h3><p style="font-size:14.5px;line-height:1.6;color:#4B4B4B;margin:0">Un groupe motivé et un coach qui répond à tes questions chaque jour.</p></div>
    </div>
  </div></section>

  <!-- MARQUEE 2 -->
  <div style="background:#000;overflow:hidden;white-space:nowrap;padding:14px 0">
    <div data-marquee style="display:inline-block;white-space:nowrap;will-change:transform"><span class="bebas" style="font-size:22px;letter-spacing:.08em;color:#FACC15">PAS D'EXCUSES&nbsp;&nbsp;•&nbsp;&nbsp;<span style="color:#fff">JUSTE DES RÉSULTATS</span>&nbsp;&nbsp;•&nbsp;&nbsp;<span style="color:#F97316">8 SEMAINES POUR CHANGER</span>&nbsp;&nbsp;•&nbsp;&nbsp;PAS D'EXCUSES&nbsp;&nbsp;•&nbsp;&nbsp;<span style="color:#fff">JUSTE DES RÉSULTATS</span>&nbsp;&nbsp;•&nbsp;&nbsp;<span style="color:#F97316">8 SEMAINES POUR CHANGER</span>&nbsp;&nbsp;•&nbsp;&nbsp;</span></div>
  </div>

  <!-- PRICING -->
  <section id="prix" style="background:#fff"><div style="max-width:1080px;margin:0 auto;padding:84px 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:48px"><div style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#EF4444;font-weight:700;margin-bottom:10px">Choisis ton plan</div><h2 class="bebas" style="font-size:52px;letter-spacing:.03em;text-transform:uppercase;color:#000;margin:0">Prêt à en découdre ?</h2></div>
    <div data-price style="display:grid;grid-template-columns:repeat(3,1fr);gap:22px;align-items:stretch">
      <div data-reveal style="border:2px solid #000;border-radius:8px;padding:34px 28px;display:flex;flex-direction:column;background:#fff">
        <div class="bebas" style="font-size:28px;letter-spacing:.04em;text-transform:uppercase;color:#000;margin-bottom:6px">Starter</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:18px"><span class="bebas" style="font-size:56px;color:#EF4444;line-height:.9">39€</span><span style="font-size:14px;color:#6B6B6B">/mois</span></div>
        <ul style="list-style:none;padding:0;margin:0 0 26px;display:flex;flex-direction:column;gap:12px;font-size:14.5px;color:#333">
          <li style="display:flex;gap:10px"><span style="color:#EF4444;font-weight:700">✓</span>Les 48 séances vidéo</li>
          <li style="display:flex;gap:10px"><span style="color:#EF4444;font-weight:700">✓</span>Plan nutrition de base</li>
          <li style="display:flex;gap:10px"><span style="color:#EF4444;font-weight:700">✓</span>Accès à l'appli mobile</li>
        </ul>
        <a href="#" class="af-cta" style="margin-top:auto;text-align:center;padding:14px;border-radius:4px;background:#000;color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-decoration:none;font-size:14px">Choisir Starter</a>
      </div>
      <div data-reveal data-delay="120" style="position:relative;border-radius:8px;padding:34px 28px;display:flex;flex-direction:column;background:linear-gradient(150deg,#EF4444,#F97316);color:#fff;box-shadow:0 20px 44px rgba(239,68,68,.35);transform:scale(1.03)">
        <div class="bebas" style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:#000;color:#FACC15;font-size:15px;letter-spacing:.08em;padding:5px 18px;border-radius:4px;white-space:nowrap">Le plus populaire</div>
        <div class="bebas" style="font-size:28px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px">Pro</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:18px"><span class="bebas" style="font-size:56px;color:#FACC15;line-height:.9">69€</span><span style="font-size:14px;color:rgba(255,255,255,.85)">/mois</span></div>
        <ul style="list-style:none;padding:0;margin:0 0 26px;display:flex;flex-direction:column;gap:12px;font-size:14.5px;color:#fff">
          <li style="display:flex;gap:10px"><span style="color:#FACC15;font-weight:700">✓</span>Tout le plan Starter</li>
          <li style="display:flex;gap:10px"><span style="color:#FACC15;font-weight:700">✓</span>Plan nutrition personnalisé</li>
          <li style="display:flex;gap:10px"><span style="color:#FACC15;font-weight:700">✓</span>Communauté privée + coach</li>
          <li style="display:flex;gap:10px"><span style="color:#FACC15;font-weight:700">✓</span>Suivi hebdomadaire</li>
        </ul>
        <a href="#" class="af-cta" style="margin-top:auto;text-align:center;padding:14px;border-radius:4px;background:#000;color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-decoration:none;font-size:14px">Choisir Pro</a>
      </div>
      <div data-reveal data-delay="240" style="border:2px solid #000;border-radius:8px;padding:34px 28px;display:flex;flex-direction:column;background:#fff">
        <div class="bebas" style="font-size:28px;letter-spacing:.04em;text-transform:uppercase;color:#000;margin-bottom:6px">Elite</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:18px"><span class="bebas" style="font-size:56px;color:#EF4444;line-height:.9">129€</span><span style="font-size:14px;color:#6B6B6B">/mois</span></div>
        <ul style="list-style:none;padding:0;margin:0 0 26px;display:flex;flex-direction:column;gap:12px;font-size:14.5px;color:#333">
          <li style="display:flex;gap:10px"><span style="color:#EF4444;font-weight:700">✓</span>Tout le plan Pro</li>
          <li style="display:flex;gap:10px"><span style="color:#EF4444;font-weight:700">✓</span>Coaching visio 1:1</li>
          <li style="display:flex;gap:10px"><span style="color:#EF4444;font-weight:700">✓</span>Bilan physique mensuel</li>
        </ul>
        <a href="#" class="af-cta" style="margin-top:auto;text-align:center;padding:14px;border-radius:4px;background:#000;color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-decoration:none;font-size:14px">Choisir Elite</a>
      </div>
    </div>
  </div></section>

  <!-- CITATION -->
  <section style="background:#fff"><div style="max-width:820px;margin:0 auto;padding:40px 24px 84px;text-align:center">
    
    <blockquote data-reveal class="bebas" style="margin:0 0 26px;font-size:36px;line-height:1.15;letter-spacing:.02em;text-transform:uppercase;color:#000">« J'ai perdu 9 kilos et repris goût à l'effort. Le programme te tient par la main du premier au dernier jour. »</blockquote>
    <div data-reveal data-delay="120" style="display:inline-flex;align-items:center;gap:12px"><span style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#EF4444,#F97316);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">JG</span><span style="background:#EF4444;color:#fff;font-weight:700;padding:6px 12px;border-radius:4px;font-size:14px;text-transform:uppercase;letter-spacing:.04em">Julie G. · 34 ans</span></div>
  </div></section>

  <!-- FAQ -->
  <section id="faq" style="background:#F5F5F5"><div style="max-width:800px;margin:0 auto;padding:80px 24px">
    <div data-reveal style="text-align:center;margin-bottom:40px"><div style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#EF4444;font-weight:700;margin-bottom:10px">Questions</div><h2 class="bebas" style="font-size:48px;letter-spacing:.03em;text-transform:uppercase;color:#000;margin:0">Avant de te lancer</h2></div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div data-faq-item data-reveal style="background:#fff;border:2px solid #000;border-radius:6px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#000;font-size:16.5px;font-weight:700;text-align:left;cursor:pointer;font-family:inherit">Faut-il du matériel ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#EF4444">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#4B4B4B;font-size:15px;line-height:1.65">Non. Le programme se fait au poids du corps, à la maison comme en salle.</p></div></div>
      <div data-faq-item data-reveal style="background:#fff;border:2px solid #000;border-radius:6px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#000;font-size:16.5px;font-weight:700;text-align:left;cursor:pointer;font-family:inherit">Je suis débutant, c'est adapté ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#EF4444">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#4B4B4B;font-size:15px;line-height:1.65">Oui, chaque exercice a une version adaptée. Tu progresses à ton rythme.</p></div></div>
      <div data-faq-item data-reveal style="background:#fff;border:2px solid #000;border-radius:6px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#000;font-size:16.5px;font-weight:700;text-align:left;cursor:pointer;font-family:inherit">Puis-je annuler mon abonnement ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#EF4444">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#4B4B4B;font-size:15px;line-height:1.65">Oui, à tout moment depuis ton espace, sans frais ni justificatif.</p></div></div>
    </div>
  </div></section>

  <!-- CTA FINAL -->
  <section style="background:#fff"><div style="max-width:820px;margin:0 auto;padding:84px 24px;text-align:center">
    <h2 data-reveal class="bebas" style="font-size:60px;letter-spacing:.03em;text-transform:uppercase;color:#000;margin:0 0 16px">Ton défi commence maintenant</h2>
    <p data-reveal data-delay="80" style="font-size:18px;color:#4B4B4B;margin:0 0 30px">Rejoins le programme, applique, transforme-toi. Garantie satisfait ou remboursé 14 jours.</p>
    <a href="#prix" data-reveal data-delay="160" class="af-cta" style="display:inline-block;padding:18px 42px;border-radius:4px;background:linear-gradient(100deg,#EF4444,#F97316);color:#fff;font-weight:700;font-size:17px;text-decoration:none;text-transform:uppercase;letter-spacing:.05em;box-shadow:0 14px 34px rgba(239,68,68,.35)">Commencer le défi&nbsp;➤</a>
  </div></section>

  <!-- FOOTER -->
  <footer style="background:#000"><div style="max-width:1160px;margin:0 auto;padding:38px 24px;display:flex;flex-wrap:wrap;gap:22px;align-items:center;justify-content:space-between">
    <div class="bebas" style="font-size:26px;letter-spacing:.04em;color:#fff">FITNESS<span style="color:#EF4444">ZONE</span></div>
    <div style="display:flex;gap:24px;font-size:13px;color:#9A9A9A;text-transform:uppercase;letter-spacing:.04em"><a href="#" style="text-decoration:none">Mentions légales</a><a href="#" style="text-decoration:none">CGV</a><a href="#" style="text-decoration:none">Contact</a></div>
    <div style="font-size:12px;color:#666">© 2026 AutoFunnel AI</div>
  </div></footer>

</div>`;

export function FitnessDarkEnergy(props: { funnel?: Funnel }) {
  return (
    <FunnelSectionWrapper>
      <div dangerouslySetInnerHTML={{ __html: bindTemplateData(HTML, props.funnel) }} />
    </FunnelSectionWrapper>
  );
}

export default FitnessDarkEnergy;
