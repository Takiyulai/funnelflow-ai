// components/funnel/sections/RawHtmlCtaBridge.tsx
"use client";

// 🆕 CAPTURE CLONE — Pont entre les CTA d'une section clonée et AutoFunnel.
//
// ── LE PROBLÈME ─────────────────────────────────────────────────────────────
// Un tunnel cloné hérite des boutons du site source. Ils pointent vers le
// tunnel de quelqu'un d'autre, vers `#`, ou vers rien (un `<button>` piloté par
// un JS qu'on n'a pas capturé). Résultat : une page fidèle qui ne collecte
// AUCUN lead. Le clone n'a alors aucune valeur.
//
// ── POURQUOI UN PONT PAR MESSAGE ────────────────────────────────────────────
// La section clonée est rendue dans une iframe sandboxée SANS
// `allow-same-origin` (choix de sécurité assumé, cf. RawHtmlRenderer). Trois
// conséquences non négociables :
//   1. le parent ne peut pas lire ni modifier le DOM de l'iframe ;
//   2. l'iframe ne peut pas monter un composant React du parent ;
//   3. l'iframe ne peut pas écrire dans `window.top.location`.
//
// Remplacer le bouton cloné par un bouton React est donc impossible — et de
// toute façon indésirable : cela détruirait le design capturé, qui est la
// raison d'être du clone.
//
// Le bouton reste donc CELUI DU CLONE. Au clic, le runtime de l'iframe
// (`setupCtaBridge`) envoie un `postMessage`, et ce composant — qui vit dans la
// page, détient le patch et a accès au routeur — décide quoi faire.
//
// Le contenu du formulaire ne transite JAMAIS vers l'iframe : seul
// l'identifiant du spot remonte. L'iframe ne sait rien des leads.

import { useCallback, useEffect, useState } from "react";
import { PopupForm } from "@/components/funnel/PopupForm";
import type {
  CtaConfig,
  Funnel,
  FunnelPage,
  FunnelSection,
  RawHtmlPopupConfig,
} from "@/lib/funnels/types";
import { isSafeUrl } from "@/lib/funnels/cta";

type CtaActionMessage = {
  type?: string;
  sectionId?: string;
  action?: string;
  linkId?: string;
  anchorId?: string;
  href?: string;
};

type Props = {
  section: FunnelSection;
  funnel?: Funnel;
  /**
   * Page COURANTE du tunnel.
   *
   * ⚠️ Indispensable à la redirection après capture. `resolveNextDestination`
   * cherche la destination dans cet ordre : `section.formConfig`, puis
   * `section.cta`, puis `page.nextPageId`, puis la page suivante du tunnel. Une
   * section clonée n'ayant ni `formConfig` ni `cta`, les deux premières pistes
   * sont toujours vides : sans `page`, la fonction renvoyait `null` et le
   * prospect restait sur place après avoir laissé son email — la page de
   * remerciement n'était jamais atteinte.
   */
  page?: FunnelPage;
};

/** Popup en cours d'ouverture (identifiant du CTA + config résolue). */
type OpenPopup = { linkId: string; config: RawHtmlPopupConfig };

export function RawHtmlCtaBridge({ section, funnel, page }: Props) {
  const [openPopup, setOpenPopup] = useState<OpenPopup | null>(null);

  const handleAnchor = useCallback((anchorId: string) => {
    if (!anchorId) return;
    const id = anchorId.replace(/^#/, "");
    // La cible peut être n'importe où dans la page HÔTE : une section
    // AutoFunnel ajoutée sous le clone, ou une autre section clonée. On
    // cherche donc dans tout le document, pas seulement autour de la section.
    const target =
      document.getElementById(id) ??
      document.querySelector(`[data-ff-anchor="${CSS.escape(id)}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Ancre absente : on ne fait rien plutôt que de sauter en haut de page.
    // Un saut inexpliqué est plus déroutant qu'un bouton inerte.
    console.warn(`[ff-cta] Ancre introuvable dans la page : #${id}`);
  }, []);

  const handleRedirect = useCallback((href: string) => {
    const url = (href || "").trim();
    // `isSafeUrl` refuse javascript:, data:, file: — le href vient d'un site
    // tiers cloné, on ne lui fait aucune confiance.
    if (!url || !isSafeUrl(url)) {
      console.warn("[ff-cta] URL de redirection absente ou refusée :", href);
      return;
    }
    if (/^https?:\/\//i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = url;
    }
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as CtaActionMessage | null;
      if (!data || typeof data !== "object") return;
      if (data.type !== "ff-cta-action") return;
      // Plusieurs sections clonées coexistent sur une page : chaque pont ne
      // traite que les messages de SA section.
      if (data.sectionId !== section.id) return;

      const action = data.action;

      if (action === "popup") {
        const linkId = data.linkId || "";
        const patch = linkId
          ? section.rawHtmlPatches?.links?.[linkId]
          : undefined;
        setOpenPopup({ linkId, config: patch?.popup ?? {} });
        return;
      }

      if (action === "anchor") {
        handleAnchor(data.anchorId || "");
        return;
      }

      if (action === "redirect") {
        handleRedirect(data.href || "");
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [section.id, section.rawHtmlPatches, handleAnchor, handleRedirect]);

  if (!openPopup) return null;

  // CtaConfig synthétique : le PopupForm attend cette forme. Le libellé n'est
  // jamais affiché comme déclencheur (mode contrôlé), seulement sur le bouton
  // d'envoi du formulaire.
  const cta: CtaConfig = {
    mode: "popup",
    popupProvider: "internal",
    label: openPopup.config.title || "Valider",
    popupTitle: openPopup.config.title,
    popupBody: openPopup.config.body,
    popupReassurance: openPopup.config.reassurance,
    captureTags: openPopup.config.captureTags,
    captureListIds: openPopup.config.captureListIds,
    // Le serveur utilise uniquement cet identifiant de spot pour retrouver la
    // configuration du popup dans le snapshot publié. Aucun ID de liste ne lui
    // est transmis par le visiteur.
    popupId: openPopup.linkId,
  };

  return (
    <PopupForm
      cta={cta}
      section={section}
      funnel={funnel}
      page={page}
      customFields={openPopup.config.fields}
      controlledOpen
      onControlledClose={() => setOpenPopup(null)}
    />
  );
}
