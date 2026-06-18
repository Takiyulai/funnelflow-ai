// components/support/TawkToWidget.tsx
"use client";

import Script from "next/script";
import { useEffect } from "react";

/**
 * Widget de chat support Tawk.to, intégré « à la Next.js » via <Script>.
 *
 * ⚠️ À placer UNIQUEMENT dans l'espace connecté (AppShell) — JAMAIS dans le
 * layout racine ni sur les pages publiques `/tunnel/[slug]`. Les visiteurs des
 * tunnels de nos clients ne doivent pas voir ce widget.
 *
 * L'ID de property Tawk.to est public (ce n'est pas un secret).
 *
 * Si un nom/email est disponible côté app, on les passe à Tawk.to via
 * `Tawk_API.visitor` AVANT le chargement du script (recommandation officielle),
 * pour savoir qui écrit. Sinon, widget standard.
 */

const TAWK_PROPERTY_ID = "6a334cd633d9c11d459a6546";
const TAWK_WIDGET_ID = "1jrc68ah5";
const TAWK_SRC = `https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`;

type Props = {
  /** Nom du visiteur connecté (optionnel) — pré-rempli dans Tawk.to. */
  visitorName?: string;
  /** Email du visiteur connecté (optionnel) — pré-rempli dans Tawk.to. */
  visitorEmail?: string;
};

declare global {
  interface Window {
    Tawk_API?: Record<string, unknown> & { visitor?: { name?: string; email?: string } };
    Tawk_LoadStart?: Date;
  }
}

export function TawkToWidget({ visitorName, visitorEmail }: Props) {
  // Pré-renseignement des infos visiteur : doit être positionné AVANT que le
  // script Tawk.to ne s'exécute. On initialise Tawk_API tôt côté client.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = window.Tawk_LoadStart || new Date();
    if (visitorName || visitorEmail) {
      window.Tawk_API.visitor = {
        ...(visitorName ? { name: visitorName } : {}),
        ...(visitorEmail ? { email: visitorEmail } : {}),
      };
    }
  }, [visitorName, visitorEmail]);

  return (
    <Script
      id="tawkto-widget"
      strategy="afterInteractive"
      // Reproduit fidèlement le snippet officiel (async + crossorigin),
      // mais piloté par next/script — pas de <script> brut inséré à la main.
      onError={() => {
        // Échec de chargement non bloquant (réseau, bloqueur de pub…).
        console.warn("[TawkToWidget] échec du chargement du widget Tawk.to");
      }}
    >
      {`
        var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
        (function(){
          var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
          s1.async=true;
          s1.src='${TAWK_SRC}';
          s1.charset='UTF-8';
          s1.setAttribute('crossorigin','*');
          s0.parentNode.insertBefore(s1,s0);
        })();
      `}
    </Script>
  );
}

export default TawkToWidget;
