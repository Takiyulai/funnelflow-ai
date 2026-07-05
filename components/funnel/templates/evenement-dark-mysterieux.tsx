"use client";

// Template bespoke — reproduction fidèle du design Claude Design (T3 Evenement Dark Mysterieux.dc.html).
// Contenu de démo par défaut. Animations (reveal/tilt/parallax/countdown/
// accordéon/marquee) câblées par FunnelSectionWrapper via les attributs data-*.

import type { Funnel } from "@/lib/funnels/types";
import { FunnelSectionWrapper } from "@/components/funnel/FunnelSectionWrapper";
import { bindTemplateData } from "./bind";

const HTML = `<style>@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
@keyframes af-shine{0%{transform:translateX(-160%) skewX(-18deg)}55%,100%{transform:translateX(360%) skewX(-18deg)}}
@keyframes hp-cta{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes hp-pulse-ring{0%{box-shadow:0 0 0 0 rgba(255,0,127,.45)}70%{box-shadow:0 0 0 22px rgba(255,0,127,0)}100%{box-shadow:0 0 0 0 rgba(255,0,127,0)}}
@keyframes hp-float-a{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(18px,-26px,0)}}
@keyframes hp-float-b{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(-22px,20px,0)}}
@keyframes hp-badge-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
[data-reveal]{opacity:0;transform:translateY(26px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
[data-reveal].is-in{opacity:1;transform:none}
[data-acc-panel]{max-height:0;overflow:hidden;transition:max-height .4s ease}
[data-tilt-inner]{transition:transform .18s ease}
.af-cta{position:relative;overflow:hidden;isolation:isolate;will-change:transform}
.af-cta::after{content:"";position:absolute;top:0;left:0;width:34%;height:100%;z-index:-1;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);animation:af-shine 2.8s ease-in-out infinite;pointer-events:none}

@container (max-width:880px){[data-grid=split]{grid-template-columns:1fr !important;gap:40px !important}[data-nav-links]{display:none !important}[data-hamburger]{display:inline-flex !important}[data-h1]{font-size:44px !important}[data-cols]{grid-template-columns:1fr !important}[data-price]{grid-template-columns:1fr !important}}</style>
<div style="min-height:100vh;background:#0F0F0F;color:#E7E7E7;font-family:'Space Grotesk',system-ui,sans-serif;position:relative;overflow:hidden;-webkit-font-smoothing:antialiased">

  <!-- dot grid overlay -->
  <div style="position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.06) 1px,transparent 1px);background-size:28px 28px;pointer-events:none;z-index:0"></div>
  <!-- glow blobs -->
  <div data-parallax="0.07" style="position:absolute;top:-140px;left:50%;transform:translateX(-50%);width:640px;height:520px;background:radial-gradient(circle,rgba(255,0,127,.34),transparent 62%);filter:blur(40px);pointer-events:none;z-index:0"></div>
  <div data-parallax="0.1" style="position:absolute;top:900px;right:-180px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(123,31,162,.42),transparent 62%);filter:blur(36px);pointer-events:none;animation:hp-float-b 16s ease-in-out infinite;z-index:0"></div>

  <div style="position:relative;z-index:2">

  <!-- template hint strip -->
  

  <!-- NAV -->
  <nav style="max-width:1180px;margin:0 auto;padding:22px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px">
    <div style="display:flex;align-items:center;gap:11px;font-weight:700;font-size:19px;letter-spacing:.02em;text-transform:uppercase">
      <span style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#FF007F,#7B1FA2);display:inline-block"></span>
      AutoFunnel<span style="color:#FF007F">AI</span>
    </div>
    <a href="#places" class="af-cta" style="padding:11px 22px;border-radius:30px;background:linear-gradient(100deg,#FF007F,#7B1FA2);color:#fff;font-weight:600;font-size:14.5px;text-decoration:none;box-shadow:0 10px 30px rgba(255,0,127,.32)">Je veux ma place</a>
    <button data-hamburger style="display:none;background:none;border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:9px;padding:8px 11px;font-size:16px;cursor:pointer">☰</button>
  </nav>

  <!-- HERO -->
  <header style="max-width:920px;margin:0 auto;padding:64px 24px 48px;text-align:center">
    
    <div data-reveal style="display:inline-flex;align-items:center;gap:9px;padding:8px 18px;border-radius:30px;background:rgba(255,0,127,.1);border:1px solid rgba(255,0,127,.3);font-size:12.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#FF6BB0;margin-bottom:30px">✦ Événement en ligne · Une seule date</div>
    <h1 data-h1 data-reveal data-delay="80" style="font-size:64px;line-height:1.02;font-weight:700;letter-spacing:.02em;text-transform:uppercase;margin:0 0 22px;color:#fff">L'atelier <span style="background:linear-gradient(100deg,#FF007F,#B14BF2);-webkit-background-clip:text;background-clip:text;color:transparent">Tunnel Express</span></h1>
    <p data-reveal data-delay="160" style="font-size:19px;line-height:1.6;color:#ADADAD;max-width:600px;margin:0 auto 34px">Trois heures pour concevoir, écrire et publier un tunnel de vente complet — en direct, avec l'IA d'AutoFunnel comme copilote.</p>
    <div data-reveal data-delay="240" style="display:flex;flex-direction:column;align-items:center;gap:16px">
      <a href="#places" class="af-cta" style="padding:18px 40px;border-radius:34px;background:linear-gradient(100deg,#FF007F,#7B1FA2);color:#fff;font-weight:700;font-size:18px;text-decoration:none;box-shadow:0 16px 44px rgba(255,0,127,.4);animation:hp-cta 3.2s ease-in-out infinite">Réserver ma place&nbsp;➔</a>
      <div style="display:flex;align-items:center;gap:18px;font-size:14px;color:#8A8A8A;flex-wrap:wrap;justify-content:center"><span>📅 Samedi 26 juillet · 10h00</span><span style="width:4px;height:4px;border-radius:50%;background:#FF007F"></span><span>⏱ 3 heures en direct</span></div>
    </div>
  </header>

  <!-- BENEFICES (border-left) -->
  <section style="max-width:1080px;margin:80px auto;padding:0 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:44px"><div style="font-size:12.5px;letter-spacing:.2em;text-transform:uppercase;color:#FF6BB0;font-weight:600;margin-bottom:12px">Le déroulé</div><h2 style="font-size:38px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:#fff;margin:0">Ce qu'on construit ensemble</h2></div>
    <div data-cols style="display:grid;grid-template-columns:repeat(2,1fr);gap:18px">
      <div data-reveal style="background:#222;border-left:2px solid #FF007F;border-radius:12px;padding:26px"><div style="font-size:12px;letter-spacing:.16em;color:#FF6BB0;margin-bottom:8px">HEURE 1</div><h3 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 8px">La stratégie de ton tunnel</h3><p style="font-size:14.5px;line-height:1.6;color:#ADADAD;margin:0">On cartographie ton offre et le parcours idéal de ton client.</p></div>
      <div data-reveal data-delay="80" style="background:#222;border-left:2px solid #7B1FA2;border-radius:12px;padding:26px"><div style="font-size:12px;letter-spacing:.16em;color:#C77BE0;margin-bottom:8px">HEURE 1</div><h3 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 8px">Le copywriting généré par l'IA</h3><p style="font-size:14.5px;line-height:1.6;color:#ADADAD;margin:0">Titres, accroches et arguments écrits en direct, ajustés à ta voix.</p></div>
      <div data-reveal data-delay="160" style="background:#222;border-left:2px solid #7B1FA2;border-radius:12px;padding:26px"><div style="font-size:12px;letter-spacing:.16em;color:#C77BE0;margin-bottom:8px">HEURE 2</div><h3 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 8px">Le design des pages</h3><p style="font-size:14.5px;line-height:1.6;color:#ADADAD;margin:0">Un tunnel cohérent et élégant, assemblé sans toucher au code.</p></div>
      <div data-reveal data-delay="240" style="background:#222;border-left:2px solid #FF007F;border-radius:12px;padding:26px"><div style="font-size:12px;letter-spacing:.16em;color:#FF6BB0;margin-bottom:8px">HEURE 3</div><h3 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 8px">La mise en ligne & les emails</h3><p style="font-size:14.5px;line-height:1.6;color:#ADADAD;margin:0">On publie, on branche le paiement et on programme les relances.</p></div>
    </div>
  </section>

  <!-- POUR QUI (glassmorphism) -->
  <section style="max-width:1180px;margin:96px auto;padding:0 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:44px"><div style="font-size:12.5px;letter-spacing:.2em;text-transform:uppercase;color:#FF6BB0;font-weight:600;margin-bottom:12px">Pour qui</div><h2 style="font-size:38px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:#fff;margin:0">Cet atelier est pour toi</h2></div>
    <div data-cols style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px">
      <div data-reveal data-tilt style="perspective:900px"><div data-tilt-inner style="height:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:26px;backdrop-filter:blur(12px)"><div style="font-size:24px;color:#FF007F;margin-bottom:14px">✦</div><h3 style="font-size:17px;font-weight:600;color:#fff;margin:0 0 8px">Coachs & mentors</h3><p style="font-size:14px;line-height:1.55;color:#9E9E9E;margin:0">Tu vends ton accompagnement mais tu manques de flux entrant.</p></div></div>
      <div data-reveal data-delay="80" data-tilt style="perspective:900px"><div data-tilt-inner style="height:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:26px;backdrop-filter:blur(12px)"><div style="font-size:24px;color:#FF007F;margin-bottom:14px">◆</div><h3 style="font-size:17px;font-weight:600;color:#fff;margin:0 0 8px">Créatrices de contenu</h3><p style="font-size:14px;line-height:1.55;color:#9E9E9E;margin:0">Ta communauté est là — il te manque le tunnel pour monétiser.</p></div></div>
      <div data-reveal data-delay="160" data-tilt style="perspective:900px"><div data-tilt-inner style="height:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:26px;backdrop-filter:blur(12px)"><div style="font-size:24px;color:#FF007F;margin-bottom:14px">▲</div><h3 style="font-size:17px;font-weight:600;color:#fff;margin:0 0 8px">Consultants</h3><p style="font-size:14px;line-height:1.55;color:#9E9E9E;margin:0">Tu veux un système qui qualifie tes prospects avant l'appel.</p></div></div>
      <div data-reveal data-delay="240" data-tilt style="perspective:900px"><div data-tilt-inner style="height:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:26px;backdrop-filter:blur(12px)"><div style="font-size:24px;color:#FF007F;margin-bottom:14px">●</div><h3 style="font-size:17px;font-weight:600;color:#fff;margin:0 0 8px">Lanceurs de produit</h3><p style="font-size:14px;line-height:1.55;color:#9E9E9E;margin:0">Un lancement approche et tu veux une page qui convertit.</p></div></div>
    </div>
  </section>

  <!-- PRIX (Basic & Premium) -->
  <section id="places" style="max-width:960px;margin:100px auto;padding:0 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:48px"><div style="font-size:12.5px;letter-spacing:.2em;text-transform:uppercase;color:#FF6BB0;font-weight:600;margin-bottom:12px">Réserve ta place</div><h2 style="font-size:38px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:#fff;margin:0">Choisis ton accès</h2></div>
    <div data-price style="display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:stretch">
      <div data-reveal style="background:#1E1E1E;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:36px 30px;display:flex;flex-direction:column">
        <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#9E9E9E;margin-bottom:12px">Accès Basic</div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px"><span style="font-size:44px;font-weight:700;color:#FFD700">47 €</span></div>
        <p style="font-size:14px;color:#9E9E9E;margin:0 0 22px">L'atelier en direct, l'essentiel pour démarrer.</p>
        <div style="font-size:14.5px;color:#C8C8C8;line-height:2;margin-bottom:26px">Atelier live 3h <span style="color:#7B1FA2">·</span> Support PDF <span style="color:#7B1FA2">·</span> Modèle de tunnel</div>
        <a href="#" class="af-cta" style="margin-top:auto;text-align:center;padding:15px;border-radius:30px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:#fff;font-weight:600;text-decoration:none">Choisir Basic</a>
      </div>
      <div data-reveal data-delay="120" style="position:relative;border-radius:20px;padding:2px;background:linear-gradient(135deg,#FF007F,#7B1FA2)">
        <div style="position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:linear-gradient(100deg,#FF007F,#7B1FA2);color:#fff;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:6px 16px;border-radius:20px;white-space:nowrap">Le plus choisi</div>
        <div style="background:#1E1E1E;border-radius:18px;padding:36px 30px;height:100%;display:flex;flex-direction:column">
          <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#FF6BB0;margin-bottom:12px">Accès Premium</div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px"><span style="font-size:44px;font-weight:700;color:#FFD700">97 €</span><span style="font-size:15px;color:#9E9E9E;text-decoration:line-through">147 €</span></div>
          <p style="font-size:14px;color:#C8C8C8;margin:0 0 22px">L'atelier + l'accompagnement pour aller au bout.</p>
          <div style="font-size:14.5px;color:#E7E7E7;line-height:2;margin-bottom:26px">Tout le Basic <span style="color:#FF007F">·</span> Replay à vie <span style="color:#FF007F">·</span> Q&amp;A privée <span style="color:#FF007F">·</span> Audit de ton tunnel</div>
          <a href="#" class="af-cta" style="margin-top:auto;text-align:center;padding:15px;border-radius:30px;background:linear-gradient(100deg,#FF007F,#7B1FA2);color:#fff;font-weight:700;text-decoration:none;box-shadow:0 12px 30px rgba(255,0,127,.35)">Choisir Premium</a>
        </div>
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section id="faq" style="max-width:800px;margin:96px auto;padding:0 24px">
    <div data-reveal style="text-align:center;margin-bottom:44px"><div style="font-size:12.5px;letter-spacing:.2em;text-transform:uppercase;color:#FF6BB0;font-weight:600;margin-bottom:12px">Questions</div><h2 style="font-size:36px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:#fff;margin:0">Avant de réserver</h2></div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div data-faq-item data-reveal style="background:#1A1A1A;border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#fff;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">L'atelier est-il enregistré ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#FF6BB0">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#9E9E9E;font-size:15px;line-height:1.65">Oui pour l'accès Premium : le replay reste disponible à vie dans ton espace.</p></div></div>
      <div data-faq-item data-reveal style="background:#1A1A1A;border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#fff;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Dois-je préparer quelque chose ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#FF6BB0">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#9E9E9E;font-size:15px;line-height:1.65">Juste ton idée d'offre. On construit tout le reste ensemble pendant les 3 heures.</p></div></div>
      <div data-faq-item data-reveal style="background:#1A1A1A;border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#fff;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Puis-je passer de Basic à Premium ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#FF6BB0">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#9E9E9E;font-size:15px;line-height:1.65">Oui, jusqu'à 24 h avant l'atelier, en réglant simplement la différence.</p></div></div>
      <div data-faq-item data-reveal style="background:#1A1A1A;border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#fff;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Et si je ne suis pas satisfait ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#FF6BB0">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#9E9E9E;font-size:15px;line-height:1.65">Tu es remboursé intégralement si tu nous écris dans les 7 jours suivant l'atelier.</p></div></div>
    </div>
  </section>

  <!-- CTA FINAL -->
  <section style="max-width:1080px;margin:96px auto 0;padding:0 24px">
    <div data-reveal style="position:relative;overflow:hidden;border-radius:26px;padding:64px 32px;text-align:center;background:#161016;border:1px solid rgba(255,255,255,.1)">
      <div style="position:absolute;top:-90px;left:50%;transform:translateX(-50%);width:440px;height:440px;background:radial-gradient(circle,rgba(255,0,127,.32),transparent 65%);filter:blur(42px)"></div>
      <div style="position:relative;z-index:1">
        <h2 style="font-size:42px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:#fff;margin:0 0 16px">Une date. Un tunnel. Ton lancement.</h2>
        <p style="font-size:18px;color:#ADADAD;max-width:520px;margin:0 auto 30px">Les places sont limitées pour garder l'atelier interactif. Réserve la tienne maintenant.</p>
        <a href="#places" class="af-cta" style="display:inline-block;padding:18px 40px;border-radius:34px;background:linear-gradient(100deg,#FF007F,#7B1FA2);color:#fff;font-weight:700;font-size:18px;text-decoration:none;box-shadow:0 16px 44px rgba(255,0,127,.4);animation:hp-cta 3.2s ease-in-out infinite">Réserver ma place&nbsp;➔</a>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer style="border-top:1px solid rgba(255,255,255,.07);margin-top:80px;background:#0D0D0D"><div style="max-width:1180px;margin:0 auto;padding:40px 24px;display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px;text-transform:uppercase"><span style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#FF007F,#7B1FA2)"></span>AutoFunnel<span style="color:#FF007F">AI</span></div>
    <div style="display:flex;gap:22px;font-size:16px;color:#FF6BB0"><a href="#" style="text-decoration:none">◎</a><a href="#" style="text-decoration:none">✦</a><a href="#" style="text-decoration:none">◈</a></div>
    <div style="font-size:13px;color:#5A5A5A">© 2026 AutoFunnel AI</div>
  </div></footer>

  </div>
</div>`;

export function EvenementDarkMysterieux(props: { funnel?: Funnel }) {
  return (
    <FunnelSectionWrapper>
      <div dangerouslySetInnerHTML={{ __html: bindTemplateData(HTML, props.funnel) }} />
    </FunnelSectionWrapper>
  );
}

export default EvenementDarkMysterieux;
