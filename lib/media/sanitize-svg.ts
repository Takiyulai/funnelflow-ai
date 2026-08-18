// lib/media/sanitize-svg.ts
//
// 🔒 Assainissement des SVG téléversés (audit du 18 août 2026).
//
// Un SVG n'est pas une image : c'est un document XML que le navigateur exécute.
// Il peut porter <script>, des attributs d'événement (onload, onclick…), des
// URI `javascript:`, du HTML arbitraire via <foreignObject> et des références
// externes. On garde le format — les logos vectoriels sont un besoin légitime —
// mais on retire tout ce qui peut s'exécuter.
//
// ── FAIL-CLOSED, C'EST LE POINT IMPORTANT ──────────────────────────────────
// `dompurify` et `jsdom` sont importés DYNAMIQUEMENT. Si l'un manque, le
// module ne fait pas planter le build : il renvoie un échec explicite, et
// l'appelant refuse le fichier. Un SVG non assaini ne peut donc JAMAIS être
// stocké, même si une dépendance saute lors d'un déploiement.
//
// ⚠️ PRÉREQUIS D'INSTALLATION — NON EFFECTUÉS (pas d'accès npm) :
//     npm i dompurify
//     npm i jsdom --save     # actuellement en devDependencies → absent en prod
// Tant que ces deux commandes n'ont pas tourné, tout SVG sera REFUSÉ avec un
// message clair. Les autres formats ne sont pas concernés.

import "server-only";

export type SvgSanitizeResult =
  | { ok: true; svg: string; removed: number }
  | { ok: false; reason: "unavailable" | "invalid"; message: string };

/** Balises conservées : le strict nécessaire pour un logo vectoriel. */
const ALLOWED_TAGS = [
  "svg", "g", "path", "circle", "ellipse", "line", "polyline", "polygon",
  "rect", "text", "tspan", "defs", "linearGradient", "radialGradient", "stop",
  "clipPath", "mask", "pattern", "use", "symbol", "title", "desc",
  "filter", "feGaussianBlur", "feOffset", "feBlend", "feColorMatrix",
  "feComposite", "feFlood", "feMerge", "feMergeNode",
];

/**
 * Attributs conservés. Aucun `on*` : la liste est une ALLOWLIST, donc tout
 * attribut d'événement est écarté par construction, y compris ceux qui
 * n'existent pas encore.
 */
const ALLOWED_ATTR = [
  "viewBox", "xmlns", "xmlns:xlink", "version", "width", "height",
  "d", "fill", "fill-rule", "fill-opacity", "clip-rule", "clip-path",
  "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "stroke-opacity", "stroke-miterlimit",
  "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
  "points", "transform", "opacity", "offset", "stop-color", "stop-opacity",
  "gradientUnits", "gradientTransform", "patternUnits", "spreadMethod",
  "id", "class", "style", "mask", "filter", "in", "in2", "result",
  "stdDeviation", "dx", "dy", "values", "mode", "type",
  "font-family", "font-size", "font-weight", "text-anchor", "letter-spacing",
  "preserveAspectRatio",
];

export async function sanitizeSvg(source: string): Promise<SvgSanitizeResult> {
  if (!source.includes("<svg")) {
    return { ok: false, reason: "invalid", message: "Le fichier ne contient pas de balise <svg>." };
  }

  let purify: { sanitize: (s: string, cfg: Record<string, unknown>) => string };
  try {
    const [{ JSDOM }, createDOMPurify] = await Promise.all([
      import("jsdom"),
      import("dompurify").then((m) => m.default ?? m),
    ]);
    const window = new JSDOM("").window;
    purify = (createDOMPurify as unknown as (w: unknown) => typeof purify)(window);
  } catch (e) {
    // Dépendance absente ou incompatible : on REFUSE, on n'accepte pas « au cas où ».
    console.error("[sanitize-svg] Assainisseur indisponible :", e);
    return {
      ok: false,
      reason: "unavailable",
      message:
        "L'envoi de SVG est momentanément indisponible. Utilisez un PNG ou un WebP.",
    };
  }

  const before = source.length;
  const clean = purify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Interdit tout href/xlink:href sortant : une <image> ou un <use> distant
    // ferait fuiter l'IP du visiteur et permettrait d'échanger le contenu
    // après validation.
    ALLOWED_URI_REGEXP: /^(?:#|data:image\/(?:png|jpeg|gif|webp);base64,)/i,
    FORBID_TAGS: ["script", "foreignObject", "animate", "set", "handler", "iframe", "image"],
    FORBID_ATTR: ["href", "xlink:href", "formaction", "action"],
    KEEP_CONTENT: false,
  });

  if (!clean || !clean.includes("<svg")) {
    // Tout a sauté : le fichier n'était pas un logo, ou n'était que du script.
    return {
      ok: false,
      reason: "invalid",
      message: "Ce SVG ne contient aucun contenu graphique exploitable après nettoyage.",
    };
  }

  return { ok: true, svg: clean, removed: Math.max(0, before - clean.length) };
}
