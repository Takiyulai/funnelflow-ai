"use client";

// Template bespoke — reproduction fidèle du design Claude Design (T2 E-book Corporate Mixte.dc.html).
// Contenu de démo par défaut. Animations (reveal/tilt/parallax/countdown/
// accordéon/marquee) câblées par FunnelSectionWrapper via les attributs data-*.

import type { Funnel } from "@/lib/funnels/types";
import { FunnelSectionWrapper } from "@/components/funnel/FunnelSectionWrapper";
import { bindTemplateData } from "./bind";

const HTML = `<style>@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
@keyframes af-shine{0%{transform:translateX(-160%) skewX(-18deg)}55%,100%{transform:translateX(360%) skewX(-18deg)}}
@keyframes hp-cta{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes hp-badge-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
[data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
[data-reveal].is-in{opacity:1;transform:none}
[data-acc-panel]{max-height:0;overflow:hidden;transition:max-height .4s ease}
[data-tilt-inner]{transition:transform .18s ease}
.af-cta{position:relative;overflow:hidden;isolation:isolate;will-change:transform}
.af-cta::after{content:"";position:absolute;top:0;left:0;width:34%;height:100%;z-index:-1;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);animation:af-shine 2.8s ease-in-out infinite;pointer-events:none}

@container (max-width:880px){[data-grid=split]{grid-template-columns:1fr !important;gap:40px !important}[data-nav-links]{display:none !important}[data-hamburger]{display:inline-flex !important}[data-h1]{font-size:34px !important}[data-cols]{grid-template-columns:1fr !important}}</style>
<div style="min-height:100vh;background:#F8F9FA;color:#1F2937;font-family:'DM Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased">

  <!-- template hint strip -->
  

  <!-- NAV -->
  <nav style="background:#fff;border-bottom:1px solid #E9ECEF"><div style="max-width:1160px;margin:0 auto;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px">
    <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:19px;color:#0B1D3A">
      <span style="width:26px;height:26px;border-radius:7px;background:#F58A1E;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px">▤</span>
      AutoFunnel<span style="color:#2EC4B6"> AI</span>
    </div>
    <a href="#telecharger" class="af-cta" style="padding:11px 22px;border-radius:5px;background:#F58A1E;color:#fff;font-weight:700;font-size:14px;text-decoration:none;text-transform:uppercase;letter-spacing:.03em;box-shadow:0 4px 12px rgba(245,138,30,.28)">Télécharger le guide</a>
    <button data-hamburger style="display:none;background:none;border:1px solid #CBD2D9;color:#0B1D3A;border-radius:8px;padding:8px 11px;font-size:16px;cursor:pointer">☰</button>
  </div></nav>

  <!-- HERO -->
  <header style="background:#fff"><div data-grid="split" style="max-width:1160px;margin:0 auto;padding:72px 24px;display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center">
    <div>
      
      <div data-reveal style="display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:5px;background:#E7F6F4;color:#0F766E;font-size:13px;font-weight:600;margin-bottom:22px">GUIDE PDF · 42 PAGES · GRATUIT</div>
      <h1 data-h1 data-reveal data-delay="80" style="font-size:44px;line-height:1.12;font-weight:700;letter-spacing:-.02em;color:#0B1D3A;margin:0 0 20px">Le guide complet du <span style="color:#F58A1E">tunnel de vente</span> automatisé</h1>
      <p data-reveal data-delay="160" style="font-size:18px;line-height:1.6;color:#374151;margin:0 0 26px">Les 7 étapes pour transformer un visiteur en client fidèle — méthode, modèles et exemples concrets, prêts à appliquer dès aujourd'hui.</p>
      <ul data-reveal data-delay="200" style="list-style:none;padding:0;margin:0 0 30px;display:flex;flex-direction:column;gap:12px">
        <li style="display:flex;align-items:center;gap:11px;font-size:15.5px;color:#374151"><span style="flex:none;width:22px;height:22px;border-radius:50%;background:#2EC4B6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px">✓</span>La structure exacte d'un tunnel rentable</li>
        <li style="display:flex;align-items:center;gap:11px;font-size:15.5px;color:#374151"><span style="flex:none;width:22px;height:22px;border-radius:50%;background:#2EC4B6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px">✓</span>12 modèles de pages à copier</li>
        <li style="display:flex;align-items:center;gap:11px;font-size:15.5px;color:#374151"><span style="flex:none;width:22px;height:22px;border-radius:50%;background:#2EC4B6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px">✓</span>La séquence email qui relance toute seule</li>
      </ul>
      <div data-reveal data-delay="240" style="display:flex;flex-wrap:wrap;align-items:center;gap:18px">
        <a href="#telecharger" class="af-cta" style="padding:16px 30px;border-radius:5px;background:#F58A1E;color:#fff;font-weight:700;font-size:16px;text-decoration:none;text-transform:uppercase;letter-spacing:.03em;box-shadow:0 8px 22px rgba(245,138,30,.3);animation:hp-cta 3.4s ease-in-out infinite">Recevoir mon guide gratuit&nbsp;➜</a>
        <div style="display:flex;align-items:center;gap:8px"><span style="color:#F58A1E;letter-spacing:1px">★★★★★</span><span style="font-size:14px;color:#6B7280">4,9/5 · 2 300 lecteurs</span></div>
      </div>
    </div>
    <div data-reveal data-delay="120" data-tilt style="perspective:1000px;display:flex;justify-content:center">
      <div data-tilt-inner style="position:relative;width:270px;height:360px;border-radius:10px;background:linear-gradient(150deg,#0B1D3A,#14315C);box-shadow:0 30px 60px rgba(11,29,58,.35);padding:32px 26px;color:#fff;overflow:hidden">
        <div style="position:absolute;top:0;left:0;width:6px;height:100%;background:#F58A1E"></div>
        <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#2EC4B6;margin-bottom:14px">E-BOOK · AUTOFUNNEL AI</div>
        <div style="font-size:27px;font-weight:700;line-height:1.15;margin-bottom:auto">7 étapes vers le tunnel automatisé</div>
        <div style="position:absolute;bottom:28px;left:26px;right:26px"><div style="height:1px;background:rgba(255,255,255,.15);margin-bottom:14px"></div><div style="font-size:13px;color:#B9C4D4">Guide pratique — édition 2026</div></div>
        <div style="position:absolute;bottom:-30px;right:-30px;width:130px;height:130px;border-radius:50%;background:rgba(46,196,182,.22)"></div>
      </div>
    </div>
  </div></header>

  <!-- CHAPITRES -->
  <section id="contenu" style="background:#fff"><div style="max-width:1160px;margin:0 auto;padding:88px 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:52px">
      <div style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#F58A1E;font-weight:700;margin-bottom:12px">Au sommaire</div>
      <h2 style="font-size:36px;font-weight:700;color:#0B1D3A;margin:0">Ce que tu vas apprendre</h2>
    </div>
    <div data-cols style="display:grid;grid-template-columns:repeat(3,1fr);gap:22px">
      <div data-reveal style="background:#fff;border:1px solid #EDF0F2;border-radius:12px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,.06)"><div style="width:50px;height:50px;border-radius:50%;background:#F58A1E;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;margin-bottom:18px">1</div><h3 style="font-size:19px;font-weight:700;color:#0B1D3A;margin:0 0 8px">Attirer le bon visiteur</h3><p style="font-size:14.5px;line-height:1.6;color:#6B7280;margin:0">Cibler une audience qui a un vrai problème à résoudre.</p></div>
      <div data-reveal data-delay="80" style="background:#fff;border:1px solid #EDF0F2;border-radius:12px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,.06)"><div style="width:50px;height:50px;border-radius:50%;background:#2EC4B6;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;margin-bottom:18px">2</div><h3 style="font-size:19px;font-weight:700;color:#0B1D3A;margin:0 0 8px">Capturer le lead</h3><p style="font-size:14.5px;line-height:1.6;color:#6B7280;margin:0">La page d'inscription qui donne envie de laisser son email.</p></div>
      <div data-reveal data-delay="160" style="background:#fff;border:1px solid #EDF0F2;border-radius:12px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,.06)"><div style="width:50px;height:50px;border-radius:50%;background:#F58A1E;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;margin-bottom:18px">3</div><h3 style="font-size:19px;font-weight:700;color:#0B1D3A;margin:0 0 8px">Nourrir la relation</h3><p style="font-size:14.5px;line-height:1.6;color:#6B7280;margin:0">La séquence email qui installe la confiance jour après jour.</p></div>
      <div data-reveal style="background:#fff;border:1px solid #EDF0F2;border-radius:12px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,.06)"><div style="width:50px;height:50px;border-radius:50%;background:#2EC4B6;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;margin-bottom:18px">4</div><h3 style="font-size:19px;font-weight:700;color:#0B1D3A;margin:0 0 8px">Présenter l'offre</h3><p style="font-size:14.5px;line-height:1.6;color:#6B7280;margin:0">Structurer une page de vente qui lève chaque objection.</p></div>
      <div data-reveal data-delay="80" style="background:#fff;border:1px solid #EDF0F2;border-radius:12px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,.06)"><div style="width:50px;height:50px;border-radius:50%;background:#F58A1E;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;margin-bottom:18px">5</div><h3 style="font-size:19px;font-weight:700;color:#0B1D3A;margin:0 0 8px">Encaisser sans friction</h3><p style="font-size:14.5px;line-height:1.6;color:#6B7280;margin:0">Un paiement fluide, des relances de panier automatiques.</p></div>
      <div data-reveal data-delay="160" style="background:#fff;border:1px solid #EDF0F2;border-radius:12px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,.06)"><div style="width:50px;height:50px;border-radius:50%;background:#2EC4B6;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;margin-bottom:18px">6</div><h3 style="font-size:19px;font-weight:700;color:#0B1D3A;margin:0 0 8px">Mesurer et optimiser</h3><p style="font-size:14.5px;line-height:1.6;color:#6B7280;margin:0">Les 4 chiffres à suivre pour améliorer ton tunnel chaque semaine.</p></div>
    </div>
  </div></section>

  <!-- CTA INTERMEDIAIRE (dark) -->
  <section style="background:#0B1D3A"><div style="max-width:900px;margin:0 auto;padding:72px 24px;text-align:center">
    
    <h2 data-reveal style="font-size:34px;font-weight:700;color:#fff;margin:0 0 14px">Reçois le guide dans ta boîte mail, gratuitement</h2>
    <p data-reveal data-delay="80" style="font-size:17px;color:#B9C4D4;margin:0 0 30px">Un PDF de 42 pages, actionnable de la première à la dernière ligne.</p>
    <a href="#telecharger" data-reveal data-delay="160" class="af-cta" style="display:inline-block;padding:16px 34px;border-radius:5px;background:#F58A1E;color:#fff;font-weight:700;font-size:16px;text-decoration:none;text-transform:uppercase;letter-spacing:.03em;box-shadow:0 8px 22px rgba(245,138,30,.35)">Télécharger maintenant</a>
  </div></section>

  <!-- TEMOIGNAGE -->
  <section id="avis" style="background:#fff"><div style="max-width:820px;margin:0 auto;padding:88px 24px;text-align:center;position:relative">
    
    <div data-reveal style="font-family:Georgia,serif;font-size:90px;line-height:.4;color:#2EC4B6;margin-bottom:10px">&ldquo;</div>
    <blockquote data-reveal data-delay="80" style="margin:0 0 26px;font-size:24px;line-height:1.5;font-weight:500;color:#0B1D3A">J'ai appliqué les 7 étapes sur mon activité de formation. En un mois, mon tunnel tournait seul et générait des ventes pendant que je dormais.</blockquote>
    <div data-reveal data-delay="160" style="display:flex;align-items:center;justify-content:center;gap:13px"><span style="width:48px;height:48px;border-radius:50%;background:#2EC4B6;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px">TB</span><span style="text-align:left"><b style="display:block;color:#0B1D3A;font-size:15.5px">Thomas Bernard</b><span style="font-size:13.5px;color:#6B7280">Formateur en ligne</span></span></div>
  </div></section>

  <!-- OBSTACLES (dark, texte long) -->
  <section style="background:#0B1D3A"><div style="max-width:960px;margin:0 auto;padding:88px 24px">
    
    <div data-reveal style="max-width:640px"><div style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#2EC4B6;font-weight:700;margin-bottom:14px">Pourquoi ce guide</div>
    <h2 style="font-size:34px;font-weight:700;color:#fff;margin:0 0 22px;line-height:1.2">La plupart des tunnels échouent pour <span style="color:#F58A1E">trois raisons</span> évitables</h2></div>
    <div data-cols style="display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:36px">
      <div data-reveal style="border-top:3px solid #F58A1E;padding-top:20px"><h3 style="font-size:18px;font-weight:700;color:#fff;margin:0 0 10px">Trop de pages</h3><p style="font-size:15px;line-height:1.65;color:#B9C4D4;margin:0">On ajoute des étapes « au cas où » et le visiteur se perd. Le guide te montre le chemin minimal.</p></div>
      <div data-reveal data-delay="80" style="border-top:3px solid #2EC4B6;padding-top:20px"><h3 style="font-size:18px;font-weight:700;color:#fff;margin:0 0 10px">Aucune relance</h3><p style="font-size:15px;line-height:1.65;color:#B9C4D4;margin:0">80 % des ventes se font après le premier contact. Sans email automatique, elles n'arrivent jamais.</p></div>
      <div data-reveal data-delay="160" style="border-top:3px solid #F58A1E;padding-top:20px"><h3 style="font-size:18px;font-weight:700;color:#fff;margin:0 0 10px">Zéro mesure</h3><p style="font-size:15px;line-height:1.65;color:#B9C4D4;margin:0">Sans chiffres, on optimise à l'aveugle. Tu sauras exactement quoi corriger, et quand.</p></div>
    </div>
  </div></section>

  <!-- FAQ -->
  <section id="faq" style="background:#fff"><div style="max-width:800px;margin:0 auto;padding:88px 24px">
    <div data-reveal style="text-align:center;margin-bottom:44px"><div style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#F58A1E;font-weight:700;margin-bottom:12px">FAQ</div><h2 style="font-size:34px;font-weight:700;color:#0B1D3A;margin:0">Questions fréquentes</h2></div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div data-faq-item data-reveal style="background:#F8F9FA;border:1px solid #EDF0F2;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#0B1D3A;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Le guide est-il vraiment gratuit ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#F58A1E">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#6B7280;font-size:15px;line-height:1.65">Oui, il te suffit de laisser ton email pour le recevoir immédiatement en PDF.</p></div></div>
      <div data-faq-item data-reveal style="background:#F8F9FA;border:1px solid #EDF0F2;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#0B1D3A;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">À qui s'adresse-t-il ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#F58A1E">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#6B7280;font-size:15px;line-height:1.65">À tout indépendant, coach ou e-commerçant qui veut vendre en ligne de façon automatisée.</p></div></div>
      <div data-faq-item data-reveal style="background:#F8F9FA;border:1px solid #EDF0F2;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#0B1D3A;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Faut-il déjà avoir un tunnel ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#F58A1E">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#6B7280;font-size:15px;line-height:1.65">Non. Le guide part de zéro et te mène jusqu'au premier tunnel publié.</p></div></div>
      <div data-faq-item data-reveal style="background:#F8F9FA;border:1px solid #EDF0F2;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#0B1D3A;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Vais-je recevoir d'autres emails ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#F58A1E">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#6B7280;font-size:15px;line-height:1.65">Tu recevras quelques conseils complémentaires, et tu peux te désinscrire à tout moment en un clic.</p></div></div>
    </div>
  </div></section>

  <!-- CTA FINAL / TELECHARGER -->
  <section id="telecharger" style="background:#0B1D3A"><div style="max-width:720px;margin:0 auto;padding:88px 24px;text-align:center">
    <h2 data-reveal style="font-size:38px;font-weight:700;color:#fff;margin:0 0 14px">Ton exemplaire t'attend</h2>
    <p data-reveal data-delay="80" style="font-size:17px;color:#B9C4D4;margin:0 0 30px">Entre ton email, reçois le guide, applique. C'est aussi simple que ça.</p>
    <form data-reveal data-delay="160" onsubmit="{{ noSubmit }}" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;max-width:520px;margin:0 auto">
      <input type="email" placeholder="ton@email.com" style="flex:1;min-width:220px;padding:16px 18px;border-radius:5px;border:1px solid #24457A;background:#0E254A;color:#fff;font-size:15px;font-family:inherit;outline:none">
      <button type="submit" class="af-cta" style="padding:16px 28px;border-radius:5px;border:none;background:#F58A1E;color:#fff;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:.03em;cursor:pointer;font-family:inherit">Recevoir le guide&nbsp;➜</button>
    </form>
    <p data-reveal data-delay="200" style="margin:16px 0 0;font-size:13px;color:#7C8AA0">🔒 Pas de spam · Désinscription en un clic</p>
  </div></section>

  <!-- FOOTER -->
  <footer style="background:#081428"><div style="max-width:1160px;margin:0 auto;padding:36px 24px;display:flex;flex-wrap:wrap;gap:22px;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px;color:#fff"><span style="width:22px;height:22px;border-radius:6px;background:#F58A1E;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px">▤</span>AutoFunnel<span style="color:#2EC4B6"> AI</span></div>
    <div style="display:flex;gap:24px;font-size:14px;color:#8A99B0"><a href="#" style="text-decoration:none">Mentions légales</a><a href="#" style="text-decoration:none">Confidentialité</a><a href="#" style="text-decoration:none">Contact</a></div>
    <div style="font-size:13px;color:#5C6B85">© 2026 AutoFunnel AI</div>
  </div></footer>

</div>`;

export function EbookCorporateMixte(props: { funnel?: Funnel }) {
  return (
    <FunnelSectionWrapper>
      <div dangerouslySetInnerHTML={{ __html: bindTemplateData(HTML, props.funnel) }} />
    </FunnelSectionWrapper>
  );
}

export default EbookCorporateMixte;
