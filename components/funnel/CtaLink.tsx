"use client";

// CtaLink — extrait de FunnelPreview.tsx pour être réutilisable par les skins
// de templates (rendu data-driven). Comportement STRICTEMENT identique :
// popup (interne/systeme/embed), ancre, redirection, navigation inter-pages
// (pageId / pageSlug / url relative résolue via slugLinks).

import { ExternalLink } from "lucide-react";
import type {
  AnimationPreset,
  Funnel,
  FunnelPage,
  FunnelSection,
} from "@/lib/funnels/types";
import { ctaHref, ctaTarget, ctaRel, ctaIsExternal, resolveCtaWithGlobal } from "@/lib/funnels/cta";
import { PopupForm } from "@/components/funnel/PopupForm";

const DEFAULT_BASE_CLASS =
  "ff-btn inline-flex items-center gap-2 px-4 py-2 text-sm font-bold no-underline rounded-lg";

export function CtaLink({
  cta: ctaProp,
  className = "",
  anim,
  pageLinks,
  slugLinks,
  funnel,
  page,
  section,
  baseClassName,
  arrow,
  isExtra: isExtraProp,
}: {
  cta: NonNullable<FunnelSection["cta"]>;
  className?: string;
  anim?: AnimationPreset;
  pageLinks: Map<string, string>;
  slugLinks: Map<string, string>;
  funnel: Funnel;
  page?: FunnelPage;
  section: FunnelSection;
  /** 🆕 Remplace les classes de base (ff-btn px-4 py-2…) pour les skins qui
   *  stylent entièrement le bouton (ex: pill dégradé T1). */
  baseClassName?: string;
  /** 🆕 Ajoute une flèche → après le label (sauf si le label en a déjà une). */
  arrow?: boolean;
  /** 🆕 Marque explicitement ce bouton comme « supplémentaire » (canaux
   *  WhatsApp/Telegram…) : exclu de l'action CTA commune, mais peut partager le
   *  MÊME style que le CTA principal. Repli rétro-compatible : détection par la
   *  classe « ff-btn-extra » si la prop est absente. */
  isExtra?: boolean;
}) {
  const base = baseClassName ?? DEFAULT_BASE_CLASS;

  // 🆕 Action CTA commune : appliquée aux CTA PRINCIPAUX uniquement. Les boutons
  // secondaires (prop isExtra, ou classe « ff-btn-extra » en repli) gardent
  // leur propre action.
  const isExtra =
    isExtraProp === true || (baseClassName ?? "").includes("ff-btn-extra");
  const cta = resolveCtaWithGlobal(
    ctaProp,
    funnel.defaultCta,
    !isExtra && funnel.meta?.applyDefaultCtaToAll === true,
  );

  const showArrow =
    arrow === true && !/[→➔➜➤›»⟶]\s*$/.test((cta.label ?? "").trim());

  if (cta.mode === "popup") {
    return (
      <PopupForm
        cta={cta}
        section={section}
        funnel={funnel}
        page={page}
        customFields={cta.popupFields}
        buttonClassName={`${base} ${className}`}
        buttonProps={{ "data-ff-anim": anim ?? "fade-up" } as React.ButtonHTMLAttributes<HTMLButtonElement>}
      />
    );
  }

  let href = ctaHref(cta);
  let target = ctaTarget(cta);
  let rel = ctaRel(cta);
  let external = ctaIsExternal(cta);

  const ctaAny = cta as unknown as {
    mode?: string;
    pageId?: string;
    pageSlug?: string;
    url?: string;
  };

  if (ctaAny.pageId && pageLinks.has(ctaAny.pageId)) {
    href = pageLinks.get(ctaAny.pageId) ?? href;
    target = "_self";
    rel = "";
    external = false;
  } else if (ctaAny.pageSlug) {
    const cleaned = ctaAny.pageSlug.replace(/^\/+/, "").replace(/\/+$/, "");
    if (slugLinks.has(cleaned)) {
      href = slugLinks.get(cleaned) ?? href;
      target = "_self";
      rel = "";
      external = false;
    }
  } else if (ctaAny.url && ctaAny.mode === "redirect") {
    const rawUrl = ctaAny.url.trim();
    const isAbsolute = /^https?:\/\//i.test(rawUrl) || rawUrl.startsWith("//");
    const isMailto = rawUrl.startsWith("mailto:") || rawUrl.startsWith("tel:");
    if (!isAbsolute && !isMailto) {
      const cleaned = rawUrl.replace(/^\/+/, "").replace(/\/+$/, "");
      if (slugLinks.has(cleaned)) {
        href = slugLinks.get(cleaned) ?? href;
        target = "_self";
        rel = "";
        external = false;
      }
    }
  }

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      data-ff-anim={anim ?? "fade-up"}
      data-ff-cta
      className={`${base} ${className}`}
    >
      {cta.label}
      {showArrow && (
        <span aria-hidden className="sk-cta-arrow">
          →
        </span>
      )}
      {/* 🆕 Pas de double flèche : l'icône « lien externe » n'apparaît PLUS
          quand la flèche décorative → est déjà affichée (évitait le doublon
          « → ⧉ » sur les CTA de redirection). */}
      {external && !showArrow && <ExternalLink size={13} />}
    </a>
  );
}

export default CtaLink;
