"use client";

// app/tunnel/[slug]/PublishedFunnelView.tsx
//
// 🆕 PARITÉ APERÇU ↔ PAGE PUBLIÉE : la page publiée rend désormais le tunnel via
// LE MÊME composant que l'aperçu (FunnelPreview) au lieu du HTML d'export. Même
// DOM, même CSS (funnel-theme.css, chargé globalement) → rendu identique.
//
// - Navigation inter-pages : FunnelPreview détecte /tunnel/[slug] dans l'URL et
//   construit les liens publics tout seul (buildPageLinkMap).
// - Formulaires : FormRenderer poste vers /api/leads nativement.
// - Checkout interne (#ff-checkout), FAQ accordéon, popups : PublicFunnelRuntime.
//   (Les formulaires de FunnelPreview n'ont pas la classe ff-form-fields, donc
//   pas de double soumission avec le runtime.)

import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import PublicFunnelRuntime from "@/components/funnel/PublicFunnelRuntime";
import { PageViewBeacon } from "@/components/funnel/PageViewBeacon";
import { TrackingPixels } from "@/components/funnel/TrackingPixels";
import type { Funnel, FunnelPage } from "@/lib/funnels/types";

export default function PublishedFunnelView({
  funnel,
  funnelSlug,
  activePage,
}: {
  funnel: Funnel;
  funnelSlug: string;
  activePage?: FunnelPage;
}) {
  return (
    // 🆕 Fin de l'espace vide sous le footer : shell en flex column, la chaîne
    // .ff-fill-col (FunnelPreview → .ff-page → body) pousse le footer en bas
    // sur les pages courtes (margin-top:auto, cf. funnel-theme.css).
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        // 🆕 Filet : tout reliquat d'espace sous le footer prend une teinte
        // sombre proche des footers (au lieu d'une bande blanche).
        background: "#0B0F14",
      }}
    >
      <FunnelPreview
        funnel={funnel}
        funnelSlug={funnelSlug}
        activePage={activePage}
        showToolbar={false}
        viewportHeight="auto"
        pageRole={activePage?.role}
        className="ff-fill-col"
      />
      <PublicFunnelRuntime />
      <PageViewBeacon />
      {/* 🆕 LOT 4 — Pixels publicitaires : pages publiées UNIQUEMENT (ce
          composant n'est jamais monté dans le dashboard/éditeur). */}
      <TrackingPixels tracking={funnel.tracking} />
    </div>
  );
}
