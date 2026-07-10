// components/legal/LegalPageShell.tsx
//
// 🆕 Coquille visuelle partagée pour les pages légales publiques (/privacy,
// /terms). Reprend la palette dark/glow de la landing page (app/page.tsx :
// BG #080E1A, accents vert/or/bleu) sans dépendre d'elle, pour rester stable
// même si la landing évolue. Pas de logique complexe : lisibilité avant tout.
//
// Composant SERVEUR (pas de "use client") : aucune interactivité requise,
// donc pas de JS envoyé au client pour ces pages purement informatives.

import type { ReactNode } from "react";
import { LEGAL_CONFIG } from "@/lib/legal/config";

const BG = "#080E1A";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "rgba(255,255,255,0.55)";

export default function LegalPageShell({
  title,
  eyebrow,
  lastUpdated,
  children,
}: {
  title: string;
  eyebrow: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <main style={{ background: BG, color: "#fff", minHeight: "100vh" }}>
      {/* 🆕 FIX build : <style jsx global> (styled-jsx) exige un Client
          Component ("use client"), or ce composant est volontairement un
          Server Component (page légale statique, zéro JS client nécessaire).
          Une balise <style> classique fonctionne en SSR sans ce problème et
          produit le même résultat (règles globales, non scopées). */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Instrument+Sans:wght@400;500;600&display=swap');
        .legal-title { font-family:'Archivo',sans-serif; letter-spacing:-0.01em; }
        .legal-body { font-family:'Instrument Sans',sans-serif; }
        .legal-content h2 {
          font-family:'Archivo',sans-serif;
          font-size: 19px;
          font-weight: 700;
          color: #fff;
          margin-top: 2.4em;
          margin-bottom: 0.7em;
          letter-spacing: -0.01em;
        }
        .legal-content h2:first-child { margin-top: 0; }
        .legal-content p {
          font-family:'Instrument Sans',sans-serif;
          font-size: 14.5px;
          line-height: 1.75;
          color: rgba(255,255,255,0.72);
          margin-bottom: 1em;
        }
        .legal-content ul {
          margin: 0 0 1.2em 0;
          padding-left: 1.3em;
          list-style: disc;
        }
        .legal-content li {
          font-family:'Instrument Sans',sans-serif;
          font-size: 14.5px;
          line-height: 1.7;
          color: rgba(255,255,255,0.72);
          margin-bottom: 0.5em;
        }
        .legal-content strong { color: #fff; font-weight: 600; }
        .legal-content a { color: #67D9A4; text-decoration: underline; text-underline-offset: 2px; }
        .legal-content a:hover { color: #C7A436; }
      `}</style>

      {/* HEADER */}
      <header style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 sm:px-6">
          <a href="/" className="flex items-center gap-2 legal-body shrink-0">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg legal-title"
              style={{ background: "linear-gradient(135deg,#31845C,#08498D)", fontSize: 12, color: "#fff" }}
            >
              AF
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>
              AutoFunnel<span style={{ color: "#C7A436" }}> AI</span>
            </span>
          </a>
          <a
            href="/"
            className="legal-body hover:text-white transition-colors"
            style={{ fontSize: 13, color: MUTED }}
          >
            ← Retour à l'accueil
          </a>
        </div>
      </header>

      {/* CONTENU */}
      <div className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-16">
        <div
          className="legal-body inline-flex items-center gap-2"
          style={{ color: "#67D9A4", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}
        >
          {eyebrow}
        </div>
        <h1 className="legal-title mt-3" style={{ fontSize: "clamp(1.7rem, 4vw, 2.3rem)", fontWeight: 800, color: "#fff" }}>
          {title}
        </h1>
        <p className="legal-body mt-3" style={{ fontSize: 13, color: MUTED }}>
          Dernière mise à jour : {lastUpdated}
        </p>

        <div style={{ height: 1, background: BORDER, margin: "2rem 0" }} />

        <article className="legal-content">{children}</article>
      </div>

      {/* FOOTER */}
      <footer style={{ background: "#060A12", borderTop: `1px solid ${BORDER}` }}>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 py-8 text-center sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
            <a href="/privacy" className="legal-body hover:text-[#C7A436] transition-colors" style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)" }}>
              Confidentialité
            </a>
            <a href="/terms" className="legal-body hover:text-[#C7A436] transition-colors" style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)" }}>
              CGU
            </a>
            <a href={`mailto:${LEGAL_CONFIG.contactEmail}`} className="legal-body hover:text-[#C7A436] transition-colors" style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)" }}>
              Contact
            </a>
          </div>
          <p className="legal-body" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            © 2026 {LEGAL_CONFIG.companyName} — {LEGAL_CONFIG.domain}
          </p>
        </div>
      </footer>
    </main>
  );
}
