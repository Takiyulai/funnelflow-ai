"use client";

// Template bespoke — reproduction fidèle du design Claude Design (T1 Webinaire Dark Glow.dc.html).
// Contenu de démo par défaut. Animations (reveal/tilt/parallax/countdown/
// accordéon/marquee) câblées par FunnelSectionWrapper via les attributs data-*.

import type { Funnel } from "@/lib/funnels/types";
import { FunnelSectionWrapper } from "@/components/funnel/FunnelSectionWrapper";
import { bindTemplateData } from "./bind";

const HTML = `<style>@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
@keyframes af-shine{0%{transform:translateX(-160%) skewX(-18deg)}55%,100%{transform:translateX(360%) skewX(-18deg)}}
@keyframes hp-cta{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes hp-pulse-ring{0%{box-shadow:0 0 0 0 rgba(255,45,120,.45)}70%{box-shadow:0 0 0 22px rgba(255,45,120,0)}100%{box-shadow:0 0 0 0 rgba(255,45,120,0)}}
@keyframes hp-float-a{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(18px,-26px,0)}}
@keyframes hp-float-b{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(-22px,20px,0)}}
@keyframes hp-badge-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
[data-reveal]{opacity:0;transform:translateY(26px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
[data-reveal].is-in{opacity:1;transform:none}
[data-acc-panel]{max-height:0;overflow:hidden;transition:max-height .4s ease}
[data-tilt-inner]{transition:transform .18s ease}

.af-cta{position:relative;overflow:hidden;isolation:isolate;will-change:transform}
.af-cta::after{content:"";position:absolute;top:0;left:0;width:34%;height:100%;z-index:-1;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);animation:af-shine 2.8s ease-in-out infinite;pointer-events:none}

@container (max-width:880px){[data-grid=split]{grid-template-columns:1fr !important;gap:40px !important}[data-nav-links]{display:none !important}[data-hamburger]{display:inline-flex !important}[data-h1]{font-size:44px !important}[data-cols]{grid-template-columns:1fr !important}[data-cd-row]{gap:12px !important}}</style>
<div style="min-height:100vh;background:#111111;color:#EDEDED;font-family:'Space Grotesk',system-ui,sans-serif;position:relative;overflow:hidden;-webkit-font-smoothing:antialiased">

  <!-- ambient glow blobs -->
  <div data-parallax="0.06" style="position:absolute;top:-160px;right:-140px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(255,45,120,.5),transparent 62%);filter:blur(30px);opacity:.55;pointer-events:none;animation:hp-float-a 14s ease-in-out infinite;z-index:0"></div>
  <div data-parallax="0.09" style="position:absolute;top:620px;left:-180px;width:560px;height:560px;border-radius:50%;background:radial-gradient(circle,rgba(108,27,242,.5),transparent 62%);filter:blur(30px);opacity:.5;pointer-events:none;animation:hp-float-b 16s ease-in-out infinite;z-index:0"></div>

  <div style="position:relative;z-index:2">

  <!-- template hint strip -->
  

  <!-- NAV -->
  <nav style="max-width:1180px;margin:0 auto;padding:22px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px">
    <div style="display:flex;align-items:center;gap:11px;font-weight:700;font-size:19px;letter-spacing:-.01em">
      <span style="width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#FF2D78,#6C1BF2);display:inline-block;transform:rotate(45deg)"></span>
      AutoFunnel<span style="color:#FF2D78">AI</span>
    </div>
    <a href="#offre" class="af-cta" style="display:inline-flex;align-items:center;gap:8px;padding:11px 22px;border-radius:30px;background:linear-gradient(100deg,#FF2D78,#6C1BF2);color:#fff;font-weight:600;font-size:14.5px;text-decoration:none;box-shadow:0 10px 30px rgba(255,45,120,.32)">Réserver ma place</a>
    <button data-hamburger style="display:none;background:none;border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:9px;padding:8px 11px;font-size:16px;cursor:pointer">☰</button>
  </nav>

  <!-- HERO -->
  <header style="max-width:900px;margin:0 auto;padding:56px 24px 40px;text-align:center;position:relative">
    

    <div data-reveal style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:30px;background:rgba(255,45,120,.12);border:1px solid rgba(255,45,120,.35);font-size:13px;font-weight:600;color:#FF7FA9;margin-bottom:26px">
      <span style="width:7px;height:7px;border-radius:50%;background:#FF2D78;box-shadow:0 0 10px #FF2D78"></span>
      Masterclass 100% en ligne · Gratuite
    </div>

    <h1 data-h1 data-reveal data-delay="80" style="font-size:60px;line-height:1.04;font-weight:700;letter-spacing:-.03em;margin:0 0 22px;color:#fff">
      Construis un tunnel de vente <span style="background:linear-gradient(100deg,#FF2D78,#B14BF2);-webkit-background-clip:text;background-clip:text;color:transparent">rentable</span> en 90 minutes — sans coder.
    </h1>

    <p data-reveal data-delay="160" style="font-size:19px;line-height:1.6;color:#B0B0B0;max-width:620px;margin:0 auto 34px">
      La masterclass où l'IA génère ton tunnel complet <b style="color:#EDEDED;font-weight:600">pendant que tu regardes</b> : copywriting, design, pages et séquences email, assemblés sous tes yeux en direct.
    </p>

    <div style="margin-top:8px;position:relative;display:flex;justify-content:center">
      <div data-tilt style="width:min(760px,100%);perspective:1000px">
        <div data-tilt-inner style="border-radius:18px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(160deg,rgba(255,255,255,.06),rgba(255,255,255,.02));backdrop-filter:blur(10px);box-shadow:0 40px 100px rgba(108,27,242,.3);overflow:hidden">
          <div style="display:flex;align-items:center;gap:7px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.08)">
            <span style="width:11px;height:11px;border-radius:50%;background:#FF2D78"></span>
            <span style="width:11px;height:11px;border-radius:50%;background:#6C1BF2"></span>
            <span style="width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,.25)"></span>
            <span style="margin-left:12px;font-size:12px;color:#7A7A7A;font-family:monospace">autofunnel.ai / live</span>
          </div>
          <div style="aspect-ratio:16/8;background:repeating-linear-gradient(135deg,rgba(255,255,255,.03) 0 12px,rgba(255,255,255,.05) 12px 24px);display:flex;align-items:center;justify-content:center;position:relative">
            <div style="width:78px;height:78px;border-radius:50%;background:linear-gradient(135deg,#FF2D78,#6C1BF2);display:flex;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(255,45,120,.6)">
              <span style="border-left:22px solid #fff;border-top:14px solid transparent;border-bottom:14px solid transparent;margin-left:6px"></span>
            </div>
            <span style="position:absolute;bottom:14px;left:16px;font-family:monospace;font-size:12px;color:#8A8A8A">[ replay de la masterclass ]</span>
          </div>
        </div>
      </div>
      <div style="position:absolute;top:-18px;right:calc(50% - 400px);background:#1A1A1A;border:1px solid rgba(255,45,120,.4);border-radius:14px;padding:12px 16px;text-align:center;box-shadow:0 12px 30px rgba(0,0,0,.5);animation:hp-badge-float 4.5s ease-in-out infinite">
        <div style="font-size:11px;letter-spacing:.12em;color:#8A8A8A;text-transform:uppercase">Jeudi</div>
        <div style="font-size:26px;font-weight:700;color:#fff;line-height:1">16</div>
        <div style="font-size:12px;color:#FF7FA9">juillet</div>
      </div>
    </div>

    <div data-reveal data-delay="120" style="margin-top:44px;display:flex;flex-direction:column;align-items:center;gap:16px">
      <a href="#offre" class="af-cta" style="display:inline-flex;align-items:center;gap:11px;padding:18px 38px;border-radius:34px;background:linear-gradient(100deg,#FF2D78,#6C1BF2);color:#fff;font-weight:700;font-size:18px;text-decoration:none;box-shadow:0 16px 44px rgba(255,45,120,.4);animation:hp-cta 3.2s ease-in-out infinite">Réserver ma place gratuite →</a>
      <div style="font-size:14px;color:#8A8A8A">Jeudi 16 juillet · 19h00 (Paris) · <span style="color:#FF7FA9">Places limitées</span></div>
    </div>
  </header>

  <!-- COUNTDOWN / URGENCE -->
  <section style="max-width:1180px;margin:40px auto;padding:0 24px">
    <div data-reveal style="background:linear-gradient(120deg,#2A0E1B,#1A0E2A);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:40px 28px;text-align:center">
      
      <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#FF7FA9;font-weight:600;margin-bottom:22px">L'inscription ferme dans</div>
      <div data-cd data-cd-row style="display:flex;justify-content:center;gap:22px;flex-wrap:wrap">
        <div style="min-width:110px;padding:20px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);animation:hp-pulse-ring 2.6s ease-out infinite">
          <div data-cd-d style="font-size:60px;font-weight:700;color:#fff;line-height:1;font-variant-numeric:tabular-nums">02</div>
          <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#B14BF2;margin-top:8px">Jours</div>
        </div>
        <div style="min-width:110px;padding:20px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)">
          <div data-cd-h style="font-size:60px;font-weight:700;color:#fff;line-height:1;font-variant-numeric:tabular-nums">14</div>
          <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#B14BF2;margin-top:8px">Heures</div>
        </div>
        <div style="min-width:110px;padding:20px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)">
          <div data-cd-m style="font-size:60px;font-weight:700;color:#fff;line-height:1;font-variant-numeric:tabular-nums">06</div>
          <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#B14BF2;margin-top:8px">Min</div>
        </div>
        <div style="min-width:110px;padding:20px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)">
          <div data-cd-s style="font-size:60px;font-weight:700;color:#fff;line-height:1;font-variant-numeric:tabular-nums">00</div>
          <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#B14BF2;margin-top:8px">Sec</div>
        </div>
      </div>
    </div>
  </section>

  <!-- POUR QUI -->
  <section id="pour-qui" style="max-width:1180px;margin:96px auto;padding:0 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:48px">
      <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#FF7FA9;font-weight:600;margin-bottom:14px">Pour qui</div>
      <h2 style="font-size:40px;font-weight:700;letter-spacing:-.02em;margin:0;color:#fff">Cette masterclass est faite pour toi si…</h2>
    </div>
    <div data-cols style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px">
      <div data-reveal data-tilt style="perspective:900px"><div data-tilt-inner style="height:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-left:3px solid #FF2D78;border-radius:16px;padding:26px;backdrop-filter:blur(8px)">
        <div style="font-size:26px;margin-bottom:14px">🎯</div>
        <h3 style="font-size:18px;font-weight:600;margin:0 0 8px;color:#fff">Créateurs & infopreneurs</h3>
        <p style="font-size:14.5px;line-height:1.6;color:#A8A8A8;margin:0">Tu as une offre mais ton tunnel te prend des semaines à monter.</p>
      </div></div>
      <div data-reveal data-delay="80" data-tilt style="perspective:900px"><div data-tilt-inner style="height:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-left:3px solid #B14BF2;border-radius:16px;padding:26px;backdrop-filter:blur(8px)">
        <div style="font-size:26px;margin-bottom:14px">🧭</div>
        <h3 style="font-size:18px;font-weight:600;margin:0 0 8px;color:#fff">Coachs & consultants</h3>
        <p style="font-size:14.5px;line-height:1.6;color:#A8A8A8;margin:0">Tu veux remplir ton agenda sans dépendre du bouche-à-oreille.</p>
      </div></div>
      <div data-reveal data-delay="160" data-tilt style="perspective:900px"><div data-tilt-inner style="height:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-left:3px solid #FF2D78;border-radius:16px;padding:26px;backdrop-filter:blur(8px)">
        <div style="font-size:26px;margin-bottom:14px">⚡</div>
        <h3 style="font-size:18px;font-weight:600;margin:0 0 8px;color:#fff">Freelances & agences</h3>
        <p style="font-size:14.5px;line-height:1.6;color:#A8A8A8;margin:0">Tu livres des tunnels à tes clients et veux dix fois plus vite.</p>
      </div></div>
      <div data-reveal data-delay="240" data-tilt style="perspective:900px"><div data-tilt-inner style="height:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-left:3px solid #B14BF2;border-radius:16px;padding:26px;backdrop-filter:blur(8px)">
        <div style="font-size:26px;margin-bottom:14px">🛒</div>
        <h3 style="font-size:18px;font-weight:600;margin:0 0 8px;color:#fff">E-commerçants</h3>
        <p style="font-size:14.5px;line-height:1.6;color:#A8A8A8;margin:0">Tu veux des pages de lancement qui convertissent, sans agence.</p>
      </div></div>
    </div>
  </section>

  <!-- FONCTIONNEMENT -->
  <section id="programme" style="max-width:1180px;margin:96px auto;padding:0 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:52px">
      <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#FF7FA9;font-weight:600;margin-bottom:14px">Au programme</div>
      <h2 style="font-size:40px;font-weight:700;letter-spacing:-.02em;margin:0;color:#fff">Ton tunnel, en 3 temps</h2>
    </div>
    <div data-cols style="display:grid;grid-template-columns:repeat(3,1fr);gap:26px">
      <div data-reveal style="position:relative;padding:32px 26px;border-radius:18px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09)">
        <div style="width:58px;height:58px;border-radius:14px;background:linear-gradient(135deg,#FF2D78,#6C1BF2);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;box-shadow:0 0 26px rgba(255,45,120,.45);margin-bottom:20px">1</div>
        <h3 style="font-size:20px;font-weight:600;margin:0 0 10px;color:#fff">Décris ton offre</h3>
        <p style="font-size:15px;line-height:1.65;color:#A8A8A8;margin:0">Ton produit, ton audience, ta promesse. Trois champs suffisent — l'IA fait le reste.</p>
      </div>
      <div data-reveal data-delay="120" style="position:relative;padding:32px 26px;border-radius:18px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09)">
        <div style="width:58px;height:58px;border-radius:14px;background:linear-gradient(135deg,#FF2D78,#6C1BF2);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;box-shadow:0 0 26px rgba(255,45,120,.45);margin-bottom:20px">2</div>
        <h3 style="font-size:20px;font-weight:600;margin:0 0 10px;color:#fff">L'IA assemble ton tunnel</h3>
        <p style="font-size:15px;line-height:1.65;color:#A8A8A8;margin:0">Pages, copywriting, design cohérent et séquence email : tout est généré en direct.</p>
      </div>
      <div data-reveal data-delay="240" style="position:relative;padding:32px 26px;border-radius:18px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09)">
        <div style="width:58px;height:58px;border-radius:14px;background:linear-gradient(135deg,#FF2D78,#6C1BF2);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;box-shadow:0 0 26px rgba(255,45,120,.45);margin-bottom:20px">3</div>
        <h3 style="font-size:20px;font-weight:600;margin:0 0 10px;color:#fff">Publie et encaisse</h3>
        <p style="font-size:15px;line-height:1.65;color:#A8A8A8;margin:0">Un clic pour mettre en ligne, connecter Stripe et suivre tes leads dans le CRM.</p>
      </div>
    </div>
  </section>

  <!-- BENEFICES -->
  <section style="max-width:1180px;margin:96px auto;padding:0 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:48px">
      <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#FF7FA9;font-weight:600;margin-bottom:14px">Ce que tu repars avec</div>
      <h2 style="font-size:40px;font-weight:700;letter-spacing:-.02em;margin:0;color:#fff">90 minutes qui changent ta façon de vendre</h2>
    </div>
    <div data-cols style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">
      <div data-reveal style="display:flex;gap:14px;padding:22px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)"><span style="flex:none;width:26px;height:26px;border-radius:50%;background:rgba(255,45,120,.18);color:#FF7FA9;display:flex;align-items:center;justify-content:center;font-size:14px">✓</span><div><h4 style="margin:0 0 5px;font-size:16px;color:#fff;font-weight:600">La structure d'un tunnel qui convertit</h4><p style="margin:0;font-size:14px;color:#A8A8A8;line-height:1.55">L'ordre exact des pages, du lead à l'achat.</p></div></div>
      <div data-reveal data-delay="80" style="display:flex;gap:14px;padding:22px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)"><span style="flex:none;width:26px;height:26px;border-radius:50%;background:rgba(255,45,120,.18);color:#FF7FA9;display:flex;align-items:center;justify-content:center;font-size:14px">✓</span><div><h4 style="margin:0 0 5px;font-size:16px;color:#fff;font-weight:600">Le prompt qui écrit ton copywriting</h4><p style="margin:0;font-size:14px;color:#A8A8A8;line-height:1.55">Des titres et accroches qui donnent envie de cliquer.</p></div></div>
      <div data-reveal data-delay="160" style="display:flex;gap:14px;padding:22px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)"><span style="flex:none;width:26px;height:26px;border-radius:50%;background:rgba(255,45,120,.18);color:#FF7FA9;display:flex;align-items:center;justify-content:center;font-size:14px">✓</span><div><h4 style="margin:0 0 5px;font-size:16px;color:#fff;font-weight:600">Ta séquence email automatique</h4><p style="margin:0;font-size:14px;color:#A8A8A8;line-height:1.55">Relances qui transforment un lead en client.</p></div></div>
      <div data-reveal style="display:flex;gap:14px;padding:22px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)"><span style="flex:none;width:26px;height:26px;border-radius:50%;background:rgba(255,45,120,.18);color:#FF7FA9;display:flex;align-items:center;justify-content:center;font-size:14px">✓</span><div><h4 style="margin:0 0 5px;font-size:16px;color:#fff;font-weight:600">Le paiement branché en 2 minutes</h4><p style="margin:0;font-size:14px;color:#A8A8A8;line-height:1.55">Stripe connecté sans une ligne de code.</p></div></div>
      <div data-reveal data-delay="80" style="display:flex;gap:14px;padding:22px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)"><span style="flex:none;width:26px;height:26px;border-radius:50%;background:rgba(255,45,120,.18);color:#FF7FA9;display:flex;align-items:center;justify-content:center;font-size:14px">✓</span><div><h4 style="margin:0 0 5px;font-size:16px;color:#fff;font-weight:600">Le suivi de tes leads dans le CRM</h4><p style="margin:0;font-size:14px;color:#A8A8A8;line-height:1.55">Chaque contact tagué et relançable au bon moment.</p></div></div>
      <div data-reveal data-delay="160" style="display:flex;gap:14px;padding:22px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)"><span style="flex:none;width:26px;height:26px;border-radius:50%;background:rgba(255,45,120,.18);color:#FF7FA9;display:flex;align-items:center;justify-content:center;font-size:14px">✓</span><div><h4 style="margin:0 0 5px;font-size:16px;color:#fff;font-weight:600">Le modèle prêt à dupliquer</h4><p style="margin:0;font-size:14px;color:#A8A8A8;line-height:1.55">Tu repars avec un tunnel réutilisable à volonté.</p></div></div>
    </div>
  </section>

  <!-- TEMOIGNAGES -->
  <section id="avis" style="max-width:1180px;margin:96px auto;padding:0 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:48px">
      <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#FF7FA9;font-weight:600;margin-bottom:14px">Ils l'ont suivie</div>
      <h2 style="font-size:40px;font-weight:700;letter-spacing:-.02em;margin:0;color:#fff">Ce qu'ils en disent</h2>
    </div>
    <div data-cols style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">
      <figure data-reveal style="margin:0;padding:28px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(8px)">
        <div style="color:#FF2D78;font-size:15px;letter-spacing:2px;margin-bottom:14px">★★★★★</div>
        <blockquote style="margin:0 0 20px;font-size:15.5px;line-height:1.65;color:#D8D8D8">« J'ai lancé mon premier tunnel le soir même. Trois ventes dans la semaine, sans avoir touché à une ligne de code. »</blockquote>
        <figcaption style="display:flex;align-items:center;gap:12px"><span style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#FF2D78,#6C1BF2);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff">LM</span><span><b style="display:block;color:#fff;font-size:14.5px">Léa Martin</b><span style="font-size:13px;color:#8A8A8A">Coach nutrition</span></span></figcaption>
      </figure>
      <figure data-reveal data-delay="120" style="margin:0;padding:28px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(8px)">
        <div style="color:#FF2D78;font-size:15px;letter-spacing:2px;margin-bottom:14px">★★★★★</div>
        <blockquote style="margin:0 0 20px;font-size:15.5px;line-height:1.65;color:#D8D8D8">« Je livre maintenant en 2 jours ce qui me prenait 2 semaines. Mes clients d'agence n'en reviennent pas. »</blockquote>
        <figcaption style="display:flex;align-items:center;gap:12px"><span style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#6C1BF2,#FF2D78);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff">KD</span><span><b style="display:block;color:#fff;font-size:14.5px">Karim Diallo</b><span style="font-size:13px;color:#8A8A8A">Freelance growth</span></span></figcaption>
      </figure>
      <figure data-reveal data-delay="240" style="margin:0;padding:28px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(8px)">
        <div style="color:#FF2D78;font-size:15px;letter-spacing:2px;margin-bottom:14px">★★★★★</div>
        <blockquote style="margin:0 0 20px;font-size:15.5px;line-height:1.65;color:#D8D8D8">« La partie séquence email a tout changé. Mon taux de conversion a doublé sur le même trafic. »</blockquote>
        <figcaption style="display:flex;align-items:center;gap:12px"><span style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#FF2D78,#B14BF2);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff">SR</span><span><b style="display:block;color:#fff;font-size:14.5px">Sophie Roux</b><span style="font-size:13px;color:#8A8A8A">Infopreneuse</span></span></figcaption>
      </figure>
    </div>
  </section>

  <!-- OFFRE / PRIX -->
  <section id="offre" style="max-width:720px;margin:110px auto;padding:0 24px;position:relative">
    
    <div style="position:absolute;inset:-40px;background:radial-gradient(circle,rgba(255,45,120,.28),transparent 70%);filter:blur(40px);z-index:0"></div>
    <div data-reveal style="position:relative;z-index:1;border-radius:24px;padding:2px;background:linear-gradient(135deg,#FF2D78,#6C1BF2)">
      <div style="border-radius:22px;background:#161016;padding:44px 36px;text-align:center;backdrop-filter:blur(12px)">
        <div style="display:inline-block;padding:6px 14px;border-radius:20px;background:rgba(255,45,120,.15);color:#FF7FA9;font-size:12.5px;font-weight:600;letter-spacing:.08em;margin-bottom:20px">ACCÈS GRATUIT · PLACES LIMITÉES</div>
        <h2 style="font-size:32px;font-weight:700;color:#fff;margin:0 0 8px;letter-spacing:-.02em">Réserve ta place à la masterclass</h2>
        <div style="display:flex;align-items:baseline;justify-content:center;gap:10px;margin:18px 0 26px"><span style="font-size:20px;color:#8A8A8A;text-decoration:line-through">197 €</span><span style="font-size:52px;font-weight:700;background:linear-gradient(100deg,#FF2D78,#B14BF2);-webkit-background-clip:text;background-clip:text;color:transparent">Gratuit</span></div>
        <ul style="list-style:none;padding:0;margin:0 auto 30px;max-width:400px;text-align:left;display:flex;flex-direction:column;gap:12px">
          <li style="display:flex;gap:11px;color:#D8D8D8;font-size:15px"><span style="color:#FF7FA9">✓</span> 90 min de démonstration en direct</li>
          <li style="display:flex;gap:11px;color:#D8D8D8;font-size:15px"><span style="color:#FF7FA9">✓</span> Le modèle de tunnel à dupliquer</li>
          <li style="display:flex;gap:11px;color:#D8D8D8;font-size:15px"><span style="color:#FF7FA9">✓</span> La séance de questions/réponses</li>
          <li style="display:flex;gap:11px;color:#D8D8D8;font-size:15px"><span style="color:#FF7FA9">✓</span> Le replay envoyé par email</li>
        </ul>
        <a href="#" class="af-cta" style="display:block;padding:18px;border-radius:30px;background:linear-gradient(100deg,#FF2D78,#6C1BF2);color:#fff;font-weight:700;font-size:18px;text-decoration:none;box-shadow:0 16px 44px rgba(255,45,120,.4)">Je réserve ma place →</a>
        <p style="margin:16px 0 0;font-size:13px;color:#7A7A7A">🔒 Sans engagement · Désinscription en un clic</p>
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section id="faq" style="max-width:800px;margin:96px auto;padding:0 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:44px">
      <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#FF7FA9;font-weight:600;margin-bottom:14px">Questions fréquentes</div>
      <h2 style="font-size:38px;font-weight:700;letter-spacing:-.02em;margin:0;color:#fff">On répond à tout</h2>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div data-faq-item data-reveal style="background:#1A1A1A;border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden">
        <button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#fff;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">C'est vraiment gratuit ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#FF7FA9">▾</span></button>
        <div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#A8A8A8;font-size:15px;line-height:1.65">Oui, 100 % gratuit. Aucune carte bancaire demandée pour t'inscrire.</p></div>
      </div>
      <div data-faq-item data-reveal style="background:#1A1A1A;border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden">
        <button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#fff;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Faut-il des compétences techniques ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#FF7FA9">▾</span></button>
        <div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#A8A8A8;font-size:15px;line-height:1.65">Aucune. Si tu sais remplir un formulaire, tu sais utiliser AutoFunnel AI.</p></div>
      </div>
      <div data-faq-item data-reveal style="background:#1A1A1A;border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden">
        <button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#fff;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Et si je ne peux pas être là en direct ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#FF7FA9">▾</span></button>
        <div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#A8A8A8;font-size:15px;line-height:1.65">Le replay est envoyé automatiquement à tous les inscrits, disponible 72 h.</p></div>
      </div>
      <div data-faq-item data-reveal style="background:#1A1A1A;border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden">
        <button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#fff;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Ça marche pour mon activité ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#FF7FA9">▾</span></button>
        <div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#A8A8A8;font-size:15px;line-height:1.65">Coaching, formation, service, e-commerce, lead magnet : la méthode s'adapte à chaque modèle.</p></div>
      </div>
      <div data-faq-item data-reveal style="background:#1A1A1A;border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden">
        <button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#fff;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Combien de temps ça dure ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#FF7FA9">▾</span></button>
        <div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#A8A8A8;font-size:15px;line-height:1.65">90 minutes, questions comprises. De quoi repartir avec un tunnel complet.</p></div>
      </div>
    </div>
  </section>

  <!-- CTA FINAL -->
  <section style="max-width:1180px;margin:96px auto 0;padding:0 24px">
    <div data-reveal style="position:relative;overflow:hidden;border-radius:26px;padding:64px 32px;text-align:center;background:linear-gradient(120deg,#2A0E1B,#1A0E2A);border:1px solid rgba(255,255,255,.1)">
      <div style="position:absolute;top:-80px;left:50%;transform:translateX(-50%);width:400px;height:400px;background:radial-gradient(circle,rgba(255,45,120,.35),transparent 65%);filter:blur(40px)"></div>
      <div style="position:relative;z-index:1">
        <h2 style="font-size:44px;font-weight:700;letter-spacing:-.02em;color:#fff;margin:0 0 16px">Ta prochaine vente se prépare jeudi soir.</h2>
        <p style="font-size:18px;color:#B0B0B0;max-width:520px;margin:0 auto 30px">Rejoins la masterclass gratuite et repars avec ton tunnel prêt à publier.</p>
        <a href="#offre" class="af-cta" style="display:inline-flex;align-items:center;gap:11px;padding:18px 40px;border-radius:34px;background:linear-gradient(100deg,#FF2D78,#6C1BF2);color:#fff;font-weight:700;font-size:18px;text-decoration:none;box-shadow:0 16px 44px rgba(255,45,120,.4);animation:hp-cta 3.2s ease-in-out infinite">Réserver ma place gratuite →</a>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer style="border-top:1px solid rgba(255,255,255,.07);margin-top:80px;background:#0D0D0D">
    <div style="max-width:1180px;margin:0 auto;padding:40px 24px;display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px"><span style="width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#FF2D78,#6C1BF2);transform:rotate(45deg)"></span>AutoFunnel<span style="color:#FF2D78">AI</span></div>
      <div style="display:flex;gap:26px;font-size:14px;color:#8A8A8A"><a href="#" style="text-decoration:none">Mentions légales</a><a href="#" style="text-decoration:none">Confidentialité</a><a href="#" style="text-decoration:none">Contact</a></div>
      <div style="font-size:13px;color:#5A5A5A">© 2026 AutoFunnel AI</div>
    </div>
  </footer>

  </div>
</div>`;

export function WebinaireDarkGlow(props: { funnel?: Funnel }) {
  return (
    <FunnelSectionWrapper>
      <div dangerouslySetInnerHTML={{ __html: bindTemplateData(HTML, props.funnel) }} />
    </FunnelSectionWrapper>
  );
}

export default WebinaireDarkGlow;
