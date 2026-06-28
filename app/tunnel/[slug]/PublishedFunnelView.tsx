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
import type { Funnel, FunnelPage } from "@/lib/funnels/types";

export default function PublishedFunnelView({
  funnel,
  activePage,
}: {
  funnel: Funnel;
  activePage?: FunnelPage;
}) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <FunnelPreview
        funnel={funnel}
        activePage={activePage}
        showToolbar={false}
        viewportHeight="auto"
        pageRole={activePage?.role}
      />
      <PublicFunnelRuntime />
    </div>
  );
}
