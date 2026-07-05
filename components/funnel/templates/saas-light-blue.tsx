"use client";

// Template bespoke — reproduction fidèle du design Claude Design (T5 SaaS Light Blue.dc.html).
// Contenu de démo par défaut. Animations (reveal/tilt/parallax/countdown/
// accordéon/marquee) câblées par FunnelSectionWrapper via les attributs data-*.

import type { Funnel } from "@/lib/funnels/types";
import { FunnelSectionWrapper } from "@/components/funnel/FunnelSectionWrapper";
import { bindTemplateData } from "./bind";

const HTML = `<style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
@keyframes af-shine{0%{transform:translateX(-160%) skewX(-18deg)}55%,100%{transform:translateX(360%) skewX(-18deg)}}
@keyframes hp-cta{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
@keyframes hp-float-a{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
[data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
[data-reveal].is-in{opacity:1;transform:none}
[data-acc-panel]{max-height:0;overflow:hidden;transition:max-height .4s ease}
[data-tilt-inner]{transition:transform .2s ease}
.af-cta{position:relative;overflow:hidden;isolation:isolate;will-change:transform}
.af-cta::after{content:"";position:absolute;top:0;left:0;width:34%;height:100%;z-index:-1;background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);animation:af-shine 2.8s ease-in-out infinite;pointer-events:none}

@container (max-width:880px){[data-grid=split]{grid-template-columns:1fr !important;gap:40px !important}[data-nav-links]{display:none !important}[data-hamburger]{display:inline-flex !important}[data-h1]{font-size:36px !important}[data-cols]{grid-template-columns:1fr !important}[data-cmp]{font-size:12px !important}}</style>
<div style="min-height:100vh;background:#fff;color:#1F2937;font-family:'Montserrat',system-ui,sans-serif;-webkit-font-smoothing:antialiased">

  <!-- template hint strip -->
  

  <!-- NAV -->
  <nav style="background:#fff;border-bottom:1px solid #EEF1F5;position:sticky;top:0;z-index:20"><div data-nav style="max-width:1160px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px">
    <div style="display:flex;align-items:center;gap:10px;font-weight:800;font-size:19px;color:#111827"><span style="width:26px;height:26px;border-radius:7px;background:#2563EB;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px">⬢</span>AutoFunnel<span style="color:#2563EB"> AI</span></div>
    <a href="#start" class="af-cta" style="padding:11px 22px;border-radius:50px;background:#2563EB;color:#fff;font-weight:600;font-size:14.5px;text-decoration:none;box-shadow:0 4px 14px rgba(37,99,235,.28)">Essai gratuit</a>
    <button data-hamburger style="display:none;background:none;border:1px solid #D1D5DB;color:#111827;border-radius:8px;padding:8px 11px;font-size:16px;cursor:pointer">☰</button>
  </div></nav>

  <!-- HERO -->
  <header style="background:#fff"><div data-grid="split" style="max-width:1160px;margin:0 auto;padding:72px 24px;display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center">
    <div>
      
      <div data-reveal style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:50px;background:#EFF4FF;color:#1D4ED8;font-size:13px;font-weight:600;margin-bottom:22px"><span style="width:7px;height:7px;border-radius:50%;background:#22C55E"></span>Nouveau · Générateur de tunnels par IA</div>
      <h1 data-h1 data-reveal data-delay="80" style="font-size:48px;line-height:1.08;font-weight:800;letter-spacing:-.02em;margin:0 0 20px;color:#111827">Vos tunnels de vente, <span style="color:#2563EB">générés en minutes</span></h1>
      <p data-reveal data-delay="160" style="font-size:18px;line-height:1.6;color:#4B5563;margin:0 0 30px">AutoFunnel AI conçoit, rédige et publie vos pages, emails et paiements — le tout depuis une seule plateforme, sans une ligne de code.</p>
      <div data-reveal data-delay="240" style="display:flex;flex-wrap:wrap;align-items:center;gap:16px">
        <a href="#start" class="af-cta" style="padding:15px 30px;border-radius:50px;background:#2563EB;color:#fff;font-weight:600;font-size:16px;text-decoration:none;box-shadow:0 8px 22px rgba(37,99,235,.3);animation:hp-cta 3.4s ease-in-out infinite">Démarrer gratuitement&nbsp;↗</a>
        <span style="font-size:14px;color:#6B7280">14 jours d'essai · Sans carte bancaire</span>
      </div>
    </div>
    <div data-reveal data-delay="120" data-tilt style="perspective:1200px">
      <div data-tilt-inner style="border-radius:14px;border:1px solid #E5E9F0;box-shadow:0 30px 70px rgba(37,99,235,.18);overflow:hidden;background:#fff">
        <div style="display:flex;align-items:center;gap:7px;padding:11px 14px;background:#F3F4F6;border-bottom:1px solid #E5E9F0"><span style="width:11px;height:11px;border-radius:50%;background:#EF4444"></span><span style="width:11px;height:11px;border-radius:50%;background:#F59E0B"></span><span style="width:11px;height:11px;border-radius:50%;background:#22C55E"></span><span style="margin-left:10px;flex:1;height:20px;border-radius:6px;background:#fff;border:1px solid #E5E9F0"></span></div>
        <div style="display:grid;grid-template-columns:64px 1fr">
          <div style="background:#F8FAFF;border-right:1px solid #EEF1F5;padding:16px 0;display:flex;flex-direction:column;align-items:center;gap:14px"><span style="width:30px;height:30px;border-radius:8px;background:#2563EB"></span><span style="width:26px;height:26px;border-radius:7px;background:#DBEAFE"></span><span style="width:26px;height:26px;border-radius:7px;background:#DBEAFE"></span><span style="width:26px;height:26px;border-radius:7px;background:#DBEAFE"></span></div>
          <div style="padding:18px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><div style="width:120px;height:12px;border-radius:6px;background:#111827"></div><div style="width:70px;height:26px;border-radius:6px;background:#2563EB"></div></div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px"><div style="height:56px;border-radius:8px;background:#EFF4FF;border:1px solid #DCE6FB"></div><div style="height:56px;border-radius:8px;background:#EFF4FF;border:1px solid #DCE6FB"></div><div style="height:56px;border-radius:8px;background:#EFF4FF;border:1px solid #DCE6FB"></div></div>
            <div style="height:96px;border-radius:8px;background:linear-gradient(120deg,#EFF4FF,#F8FAFF);border:1px solid #DCE6FB;position:relative;overflow:hidden"><div style="position:absolute;bottom:12px;left:12px;right:12px;height:44px;display:flex;align-items:flex-end;gap:6px"><span style="flex:1;height:40%;background:#93B4FB;border-radius:3px"></span><span style="flex:1;height:70%;background:#6D9BFA;border-radius:3px"></span><span style="flex:1;height:55%;background:#93B4FB;border-radius:3px"></span><span style="flex:1;height:90%;background:#2563EB;border-radius:3px"></span><span style="flex:1;height:65%;background:#6D9BFA;border-radius:3px"></span></div></div>
          </div>
        </div>
      </div>
    </div>
  </div></header>

  <!-- LOGOS / CONFIANCE -->
  <section style="background:#F3F4F6"><div style="max-width:1160px;margin:0 auto;padding:32px 24px;text-align:center">
    <div data-reveal style="font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:#9CA3AF;font-weight:600;margin-bottom:18px">Ils automatisent déjà avec AutoFunnel AI</div>
    <div data-reveal data-delay="80" style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:40px;opacity:.6">
      <span style="font-weight:800;font-size:19px;color:#4B5563;letter-spacing:-.02em">Nexora</span>
      <span style="font-weight:800;font-size:19px;color:#4B5563;letter-spacing:-.02em">Kolibri</span>
      <span style="font-weight:800;font-size:19px;color:#4B5563;letter-spacing:-.02em">Studio Vent</span>
      <span style="font-weight:800;font-size:19px;color:#4B5563;letter-spacing:-.02em">Praxio</span>
      <span style="font-weight:800;font-size:19px;color:#4B5563;letter-spacing:-.02em">Belova</span>
    </div>
  </div></section>

  <!-- FEATURES (alternées) -->
  <section id="features" style="background:#fff"><div style="max-width:1160px;margin:0 auto;padding:88px 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:52px"><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#2563EB;font-weight:700;margin-bottom:12px">Fonctionnalités</div><h2 style="font-size:38px;font-weight:800;letter-spacing:-.02em;color:#111827;margin:0">Tout le tunnel, une seule plateforme</h2></div>
    <div data-cols style="display:grid;grid-template-columns:repeat(3,1fr);gap:22px">
      <div data-reveal style="background:#fff;border:1px solid #EEF1F5;border-radius:12px;padding:28px;box-shadow:0 4px 18px rgba(17,24,39,.05)"><div style="width:46px;height:46px;border-radius:11px;background:#EFF4FF;display:flex;align-items:center;justify-content:center;margin-bottom:18px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div><h3 style="font-size:19px;font-weight:700;color:#111827;margin:0 0 8px">Pages générées par IA</h3><p style="font-size:14.5px;line-height:1.6;color:#6B7280;margin:0">Décrivez votre offre, l'IA compose des pages prêtes à convertir.</p></div>
      <div data-reveal data-delay="80" style="background:#fff;border:1px solid #EEF1F5;border-radius:12px;padding:28px;box-shadow:0 4px 18px rgba(17,24,39,.05)"><div style="width:46px;height:46px;border-radius:11px;background:#EFF4FF;display:flex;align-items:center;justify-content:center;margin-bottom:18px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg></div><h3 style="font-size:19px;font-weight:700;color:#111827;margin:0 0 8px">Séquences email</h3><p style="font-size:14.5px;line-height:1.6;color:#6B7280;margin:0">Des relances automatiques qui transforment vos leads en clients.</p></div>
      <div data-reveal data-delay="160" style="background:#fff;border:1px solid #EEF1F5;border-radius:12px;padding:28px;box-shadow:0 4px 18px rgba(17,24,39,.05)"><div style="width:46px;height:46px;border-radius:11px;background:#EFF4FF;display:flex;align-items:center;justify-content:center;margin-bottom:18px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></div><h3 style="font-size:19px;font-weight:700;color:#111827;margin:0 0 8px">Paiement intégré</h3><p style="font-size:14.5px;line-height:1.6;color:#6B7280;margin:0">Connectez Stripe et encaissez dès la première vente.</p></div>
      <div data-reveal style="background:#fff;border:1px solid #EEF1F5;border-radius:12px;padding:28px;box-shadow:0 4px 18px rgba(17,24,39,.05)"><div style="width:46px;height:46px;border-radius:11px;background:#EFF4FF;display:flex;align-items:center;justify-content:center;margin-bottom:18px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></div><h3 style="font-size:19px;font-weight:700;color:#111827;margin:0 0 8px">Analytics en temps réel</h3><p style="font-size:14.5px;line-height:1.6;color:#6B7280;margin:0">Suivez visites, conversions et revenus au même endroit.</p></div>
      <div data-reveal data-delay="80" style="background:#fff;border:1px solid #EEF1F5;border-radius:12px;padding:28px;box-shadow:0 4px 18px rgba(17,24,39,.05)"><div style="width:46px;height:46px;border-radius:11px;background:#EFF4FF;display:flex;align-items:center;justify-content:center;margin-bottom:18px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg></div><h3 style="font-size:19px;font-weight:700;color:#111827;margin:0 0 8px">CRM intégré</h3><p style="font-size:14.5px;line-height:1.6;color:#6B7280;margin:0">Chaque lead taggé, segmenté et relançable automatiquement.</p></div>
      <div data-reveal data-delay="160" style="background:#fff;border:1px solid #EEF1F5;border-radius:12px;padding:28px;box-shadow:0 4px 18px rgba(17,24,39,.05)"><div style="width:46px;height:46px;border-radius:11px;background:#EFF4FF;display:flex;align-items:center;justify-content:center;margin-bottom:18px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg></div><h3 style="font-size:19px;font-weight:700;color:#111827;margin:0 0 8px">A/B testing</h3><p style="font-size:14.5px;line-height:1.6;color:#6B7280;margin:0">Testez deux versions d'une page et gardez la plus performante.</p></div>
    </div>
  </div></section>

  <!-- COMPARATIF -->
  <section id="compare" style="background:#F3F4F6"><div style="max-width:960px;margin:0 auto;padding:88px 24px">
    
    <div data-reveal style="text-align:center;margin-bottom:44px"><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#2563EB;font-weight:700;margin-bottom:12px">Comparatif</div><h2 style="font-size:36px;font-weight:800;letter-spacing:-.02em;color:#111827;margin:0">Un outil, au lieu de cinq</h2></div>
    <div data-reveal data-delay="120" style="overflow:hidden;border-radius:14px;border:1px solid #E5E9F0;box-shadow:0 8px 26px rgba(17,24,39,.06)">
      <table data-cmp style="width:100%;border-collapse:collapse;font-size:15px;background:#fff">
        <thead><tr>
          <th style="text-align:left;padding:18px 22px;background:#fff;color:#6B7280;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.06em">Fonctionnalité</th>
          <th style="padding:18px 16px;background:#2563EB;color:#fff;font-weight:700">AutoFunnel AI</th>
          <th style="padding:18px 16px;background:#fff;color:#6B7280;font-weight:600">Constructeur classique</th>
          <th style="padding:18px 16px;background:#fff;color:#6B7280;font-weight:600">Emailing séparé</th>
        </tr></thead>
        <tbody>
          <tr style="background:#F9FAFB"><td style="padding:16px 22px;color:#374151;border-top:1px solid #EEF1F5">Génération de pages par IA</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;background:#F5F8FF;color:#2563EB;font-weight:700">✓</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;color:#D1D5DB">✗</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;color:#D1D5DB">✗</td></tr>
          <tr style="background:#fff"><td style="padding:16px 22px;color:#374151;border-top:1px solid #EEF1F5">Séquences email intégrées</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;background:#F5F8FF;color:#2563EB;font-weight:700">✓</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;color:#D1D5DB">✗</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;color:#2563EB;font-weight:700">✓</td></tr>
          <tr style="background:#F9FAFB"><td style="padding:16px 22px;color:#374151;border-top:1px solid #EEF1F5">Paiement &amp; CRM inclus</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;background:#F5F8FF;color:#2563EB;font-weight:700">✓</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;color:#D1D5DB">✗</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;color:#D1D5DB">✗</td></tr>
          <tr style="background:#fff"><td style="padding:16px 22px;color:#374151;border-top:1px solid #EEF1F5">Aucune ligne de code</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;background:#F5F8FF;color:#2563EB;font-weight:700">✓</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;color:#2563EB;font-weight:700">✓</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;color:#D1D5DB">✗</td></tr>
          <tr style="background:#F9FAFB"><td style="padding:16px 22px;color:#374151;border-top:1px solid #EEF1F5">Un seul abonnement</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;background:#F5F8FF;color:#2563EB;font-weight:700">✓</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;color:#D1D5DB">✗</td><td style="text-align:center;padding:16px;border-top:1px solid #EEF1F5;color:#D1D5DB">✗</td></tr>
        </tbody>
      </table>
    </div>
  </div></section>

  <!-- FAQ -->
  <section id="faq" style="background:#fff"><div style="max-width:800px;margin:0 auto;padding:88px 24px">
    <div data-reveal style="text-align:center;margin-bottom:44px"><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#2563EB;font-weight:700;margin-bottom:12px">FAQ</div><h2 style="font-size:36px;font-weight:800;letter-spacing:-.02em;color:#111827;margin:0">Questions fréquentes</h2></div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div data-faq-item data-reveal style="background:#F9FAFB;border:1px solid #EEF1F5;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#111827;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">L'essai est-il vraiment gratuit ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#2563EB">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#6B7280;font-size:15px;line-height:1.65">14 jours, toutes fonctionnalités incluses, sans carte bancaire demandée.</p></div></div>
      <div data-faq-item data-reveal style="background:#F9FAFB;border:1px solid #EEF1F5;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#111827;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Puis-je migrer mon tunnel existant ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#2563EB">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#6B7280;font-size:15px;line-height:1.65">Oui, l'import se fait en quelques clics et notre équipe vous accompagne si besoin.</p></div></div>
      <div data-faq-item data-reveal style="background:#F9FAFB;border:1px solid #EEF1F5;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#111827;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Faut-il savoir coder ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#2563EB">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#6B7280;font-size:15px;line-height:1.65">Jamais. Toute la plateforme fonctionne au clic, du design au paiement.</p></div></div>
      <div data-faq-item data-reveal style="background:#F9FAFB;border:1px solid #EEF1F5;border-radius:10px;overflow:hidden"><button data-acc-toggle style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 22px;background:none;border:none;color:#111827;font-size:16.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit">Puis-je annuler à tout moment ?<span data-acc-chev style="flex:none;transition:transform .3s;color:#2563EB">▾</span></button><div data-acc-panel><p style="margin:0;padding:0 22px 20px;color:#6B7280;font-size:15px;line-height:1.65">Oui, sans engagement. Vous gérez votre abonnement depuis votre tableau de bord.</p></div></div>
    </div>
  </div></section>

  <!-- CTA FINAL -->
  <section id="start" style="background:#F3F4F6"><div style="max-width:720px;margin:0 auto;padding:88px 24px;text-align:center">
    <h2 data-reveal style="font-size:40px;font-weight:800;letter-spacing:-.02em;color:#111827;margin:0 0 14px">Lancez votre premier tunnel aujourd'hui</h2>
    <p data-reveal data-delay="80" style="font-size:18px;color:#4B5563;margin:0 0 30px">14 jours gratuits. Sans carte bancaire. Annulable en un clic.</p>
    <a href="#" data-reveal data-delay="160" class="af-cta" style="display:inline-block;padding:16px 34px;border-radius:50px;background:#2563EB;color:#fff;font-weight:600;font-size:16px;text-decoration:none;box-shadow:0 10px 26px rgba(37,99,235,.32)">Démarrer gratuitement&nbsp;↗</a>
  </div></section>

  <!-- FOOTER -->
  <footer style="background:#fff;border-top:1px solid #EEF1F5"><div style="max-width:1160px;margin:0 auto;padding:34px 24px;display:flex;flex-wrap:wrap;gap:22px;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:10px;font-weight:800;font-size:17px;color:#111827"><span style="width:22px;height:22px;border-radius:6px;background:#2563EB;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px">⬢</span>AutoFunnel<span style="color:#2563EB"> AI</span></div>
    <div style="display:flex;gap:24px;font-size:14px;color:#6B7280"><a href="#" style="text-decoration:none">Mentions légales</a><a href="#" style="text-decoration:none">Confidentialité</a><a href="#" style="text-decoration:none">Contact</a></div>
    <div style="font-size:13px;color:#9CA3AF">© 2026 AutoFunnel AI</div>
  </div></footer>

</div>`;

export function SaasLightBlue(props: { funnel?: Funnel }) {
  return (
    <FunnelSectionWrapper>
      <div dangerouslySetInnerHTML={{ __html: bindTemplateData(HTML, props.funnel) }} />
    </FunnelSectionWrapper>
  );
}

export default SaasLightBlue;
