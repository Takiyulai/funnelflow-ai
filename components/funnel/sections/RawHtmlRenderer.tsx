// components/funnel/sections/RawHtmlRenderer.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RAW_HTML_BODY_MARKER } from "@/lib/clone/section-mapper";
import { applyRawHtmlPatches } from "@/lib/clone/raw-html-apply-patches";
import { detectFeatures, buildFeatureRuntime } from "@/lib/clone/feature-modules";
import type { FunnelSection } from "@/lib/funnels/types";

type ClonedBody = {
  className?: string;
  id?: string;
  style?: string;
};

type Props = {
  section: FunnelSection;
  clonedHead?: string;
  /** 🆕 Phase 1A : attributs du <body> source (fond fidèle). */
  clonedBody?: ClonedBody;
  editMode?: boolean;
  externalIframeRef?: React.MutableRefObject<HTMLIFrameElement | null>;
};

export function RawHtmlRenderer({
  section,
  clonedHead,
  clonedBody,
  editMode,
  externalIframeRef,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(400);
  const [scale, setScale] = useState<number>(1);
  const [wrapperWidth, setWrapperWidth] = useState<number>(0);

  const rawHtml = useMemo(
    () => extractRawHtml(section.body),
    [section.body],
  );

  const isEditMode = editMode === true;

  const html = useMemo(() => {
    if (!rawHtml) return null;
    return applyRawHtmlPatches(rawHtml, section.rawHtmlPatches, {
      annotate: isEditMode,
    });
  }, [rawHtml, section.rawHtmlPatches, isEditMode]);

  /**
   * 🆕 FIX « la preview clonée disparaît après un passage en mobile ».
   *
   * Le document était injecté IMPÉRATIVEMENT (`iframe.srcdoc = …`) depuis un
   * effet, sur une iframe marquée `loading="lazy"`. Or basculer desktop↔mobile
   * démonte un cadre et en monte un autre (DesktopFrame / MobileFrame sont deux
   * composants distincts) : la NOUVELLE iframe, différée par le lazy-loading et
   * hors viewport dans le cadre téléphone, ne chargeait jamais le srcdoc — et
   * l'état restait cassé au retour en desktop, puisque chaque bascule recrée
   * une iframe dans les mêmes conditions.
   *
   * Le document est désormais un PROP React (`srcDoc`) : React le pose à chaque
   * montage, sans dépendre du moment où l'effet s'exécute. Le lazy-loading est
   * retiré (le contenu est inline, il n'y a aucune requête réseau à différer).
   */
  const srcDoc = useMemo(() => {
    if (!html) return "";
    return wrapHtmlDocument(html, clonedHead, isEditMode, section.id, clonedBody);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    html,
    clonedHead,
    isEditMode,
    section.id,
    clonedBody?.className,
    clonedBody?.id,
    clonedBody?.style,
  ]);

  useEffect(() => {
    if (!html) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    // 🔒 Sécurité #1b : l'iframe raw-html n'a plus `allow-same-origin`, donc
    // `iframe.contentDocument` n'est plus accessible (origine opaque). La
    // hauteur réelle du contenu est désormais mesurée À L'INTÉRIEUR de
    // l'iframe (voir wrapHtmlDocument → interactivityScript → reportHeight)
    // et remontée ici via postMessage. On ne fait plus AUCUNE lecture directe
    // du DOM de l'iframe depuis le parent.
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as { type?: string; sectionId?: string; height?: number } | null;
      if (!data || typeof data !== "object") return;
      if (data.type !== "ff-height") return;
      if (data.sectionId !== section.id) return;
      const h = Number(data.height);
      // Plafond 60000 px pour les longs tunnels (VSL / sales pages).
      if (Number.isFinite(h) && h > 0) setIframeHeight(Math.min(60000, h));
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    html,
    clonedHead,
    isEditMode,
    section.id,
    clonedBody?.className,
    clonedBody?.id,
    clonedBody?.style,
  ]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const updateScale = () => {
      const w = wrapper.offsetWidth;
      if (w > 0) {
        if (isEditMode) {
          const newScale = Math.min(1, w / 1200);
          setScale(newScale);
        } else {
          setScale(1);
        }
        setWrapperWidth(w);
      }
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [isEditMode]);

  if (!html) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
        Section HTML personnalisée (vide).
      </div>
    );
  }

  const wrapperStyle: React.CSSProperties = isEditMode
    ? {
        height: `${iframeHeight * scale}px`,
        display: wrapperWidth >= 1200 ? "flex" : "block",
        justifyContent: "center",
        // ⚠️ Correctif : plus de fond noir forcé. Le wrapper était peint en
        // #000000 quand wrapperWidth >= 1200, et comme l'iframe scalée ne
        // remplit pas toujours toute la zone, ce noir transparaissait derrière
        // les sections à fond blanc → fonds incohérents dans l'éditeur.
        // On laisse transparent pour que le fond réel du tunnel soit le seul visible.
        backgroundColor: "transparent",
      }
    : {
        height: `${iframeHeight}px`,
        display: "block",
        backgroundColor: "transparent",
      };


  const iframeStyle: React.CSSProperties = isEditMode
    ? {
        width: "1200px",
        height: `${iframeHeight}px`,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        display: "block",
      }
    : {
        width: "100%",
        height: `${iframeHeight}px`,
        transform: "none",
        display: "block",
      };

  return (
    <div
      ref={wrapperRef}
      className="raw-html-section w-full overflow-hidden"
      style={wrapperStyle}
    >
      <iframe
        ref={(el) => {
          iframeRef.current = el;
          if (externalIframeRef) externalIframeRef.current = el;
        }}
        sandbox="allow-scripts allow-popups allow-forms"
        title="Cloned section"
        srcDoc={srcDoc}
        scrolling="no"
        className="border-0 block"
        style={iframeStyle}
      />
    </div>
  );
}

function extractRawHtml(body: string | undefined): string | null {
  if (!body) return null;
  if (!body.startsWith(RAW_HTML_BODY_MARKER)) return null;
  return body.slice(RAW_HTML_BODY_MARKER.length);
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildBodyTag(clonedBody: ClonedBody | undefined): string {
  if (!clonedBody) return "<body>";
  const attrs: string[] = [];
  if (clonedBody.className) attrs.push(`class="${escapeAttr(clonedBody.className)}"`);
  if (clonedBody.id) attrs.push(`id="${escapeAttr(clonedBody.id)}"`);
  if (clonedBody.style) attrs.push(`style="${escapeAttr(clonedBody.style)}"`);
  return attrs.length > 0 ? `<body ${attrs.join(" ")}>` : "<body>";
}

function wrapHtmlDocument(
  innerHtml: string,
  clonedHead: string | undefined,
  editMode: boolean,
  sectionId: string,
  clonedBody?: ClonedBody,
): string {
  const head =
    clonedHead && clonedHead.trim().length > 0
      ? clonedHead
      : `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>
  html, body { margin: 0; padding: 0; overflow-x: hidden; }
  img, video { max-width: 100%; height: auto; }
</style>`;

  const desktopForceStyle = editMode
    ? `
<style id="ff-desktop-force">
  html, body {
    min-width: 1200px !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
  }
  body > *:empty:last-child { display: none !important; }
  /* Parité avec le rendu public : on ne masque QUE les div vides sans
     class/id (artefacts), pas les wrappers de fond qui ont du contenu. */
  body > div:not([class]):not([id]):empty { display: none !important; }

  a, a[href] {
    pointer-events: auto !important;
    cursor: pointer !important;
  }
  button, [role="button"], [class*="btn" i], [class*="button" i] {
    pointer-events: auto !important;
    cursor: pointer !important;
  }

  [data-ff-faq] {
    cursor: pointer !important;
    user-select: none !important;
  }
  [data-ff-faq] * { cursor: pointer !important; }
  [data-ff-faq] i[class*="chevron"],
  [data-ff-faq] i[class*="arrow"],
  [data-ff-faq] svg {
    pointer-events: none !important;
  }
</style>`
    : `
<style id="ff-public-fullwidth">
  html, body {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow-x: hidden !important;
  }
  body > *:empty:last-child { display: none !important; }
  body > div:not([class]):not([id]):empty { display: none !important; }

  body > section,
  body > div,
  body > main,
  body > article {
    max-width: 100% !important;
    width: 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  section[class*="sc-"],
  div[class*="sc-"][class*="section"],
  div[class*="page-section"] {
    max-width: 100% !important;
    width: 100% !important;
  }

  img, video { max-width: 100%; height: auto; }
</style>`;

  // ───────────────────────────────────────────────────────────────────
  // ⚠️ revealHiddenStyle et faqFixStyle :
  // UNIQUEMENT en mode édition. En mode public, ces styles forceraient
  // les réponses FAQ à rester ouvertes en permanence, empêchant le
  // toggle au clic.
  // ───────────────────────────────────────────────────────────────────
  const revealHiddenStyle = editMode
    ? `
<style id="ff-reveal-hidden">
  [style*="opacity: 0"],
  [style*="opacity:0"] {
    opacity: 1 !important;
  }
  [style*="transform: translate"],
  [style*="transform:translate"],
  [style*="transform: scale(0"],
  [style*="transform:scale(0"] {
    transform: none !important;
  }
  [class*="fade-in"]:not(.visible),
  [class*="fadeIn"]:not(.visible),
  [class*="fade-up"]:not(.visible),
  [class*="fadeUp"]:not(.visible),
  [class*="reveal"]:not(.visible),
  [class*="animate-on-scroll"]:not(.visible),
  [data-aos]:not(.aos-animate),
  [data-animate]:not(.animated) {
    opacity: 1 !important;
    transform: none !important;
    visibility: visible !important;
  }

  .faq-answer, .faq__answer, .faq-content, .faqAnswer,
  [data-faq-answer],
  [class*="accordion-content"]:not([class*="header"]):not([class*="title"]),
  [class*="accordion-body"],
  [class*="accordion-panel"],
  [class*="accordion__body"],
  [class*="accordion__content"],
  [class*="collapse-content"],
  [class*="collapsible-content"] {
    display: block !important;
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
    opacity: 1 !important;
    visibility: visible !important;
  }
  details > *:not(summary) { display: block !important; }

  [style*="max-height: 0"],
  [style*="max-height:0"],
  [style*="max-height: 0px"],
  [style*="max-height:0px"] {
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
  }
</style>`
    : `
<style id="ff-reveal-hidden-public">
  /* Mode public : on révèle uniquement les animations d'apparition,
     pas les contenus FAQ qui doivent rester repliables. */
  [style*="opacity: 0"],
  [style*="opacity:0"] {
    opacity: 1 !important;
  }
  [class*="fade-in"]:not(.visible),
  [class*="fadeIn"]:not(.visible),
  [class*="fade-up"]:not(.visible),
  [class*="fadeUp"]:not(.visible),
  [class*="reveal"]:not(.visible),
  [class*="animate-on-scroll"]:not(.visible),
  [data-aos]:not(.aos-animate),
  [data-animate]:not(.animated) {
    opacity: 1 !important;
    transform: none !important;
    visibility: visible !important;
  }
</style>`;

  const faqFixStyle = editMode
    ? `
<style id="ff-faq-fix">
  [class*="accordion"] [class*="content"],
  [class*="accordion"] [class*="body"],
  [class*="accordion"] [class*="panel"],
  [class*="faq"] [class*="content"],
  [class*="faq"] [class*="body"],
  [class*="faq"] [class*="answer"],
  [class*="collapse"],
  [class*="collapsible"] > *:not(:first-child),
  [aria-expanded] + *,
  [data-state] > * {
    display: block !important;
    visibility: visible !important;
    max-height: none !important;
    height: auto !important;
    opacity: 1 !important;
    overflow: visible !important;
  }

  [class*="accordion-item"],
  [class*="faq-item"] {
    margin-bottom: 12px !important;
  }

  .fa-chevron-circle-up,
  .fa-chevron-up,
  [class*="chevron-up"] {
    transform: rotate(180deg) !important;
    transition: none !important;
  }

  [data-ff-faq] {
    display: block !important;
  }
  [data-ff-faq] > * {
    display: block !important;
    max-height: none !important;
    overflow: visible !important;
    visibility: visible !important;
    opacity: 1 !important;
  }

  [data-ff-faq-grid="unfrozen"] {
    display: flex !important;
    flex-direction: column !important;
    gap: 16px !important;
    grid-template-rows: none !important;
    grid-template-columns: none !important;
    grid-auto-rows: auto !important;
    height: auto !important;
    min-height: 0 !important;
  }
  [data-ff-faq-grid="unfrozen"] > * {
    grid-row: auto !important;
    grid-column: auto !important;
    position: relative !important;
    top: auto !important;
    left: auto !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
</style>`
    : "";

  const mediaFixStyle = `
<style id="ff-media-fix">
  img[data-ff-spot-id^="img-"],
  img[data-ff-image-id],
  video[data-ff-spot-id^="img-"],
  video[data-ff-image-id],
  iframe[data-ff-spot-id^="img-"],
  iframe[data-ff-image-id] {
    max-width: 100% !important;
    max-height: 100% !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
    display: block !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  img[data-ff-spot-id^="img-"],
  video[data-ff-spot-id^="img-"] {
    position: relative !important;
    inset: auto !important;
    top: auto !important;
    left: auto !important;
    right: auto !important;
    bottom: auto !important;
  }

  picture:has(> img[data-ff-spot-id^="img-"]),
  picture:has(> img[data-ff-image-id]),
  picture:has(> source + img[data-ff-spot-id^="img-"]) {
    display: block !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    aspect-ratio: auto !important;
    padding-bottom: 0 !important;
  }

  :has(> img[data-ff-spot-id^="img-"]),
  :has(> video[data-ff-spot-id^="img-"]),
  :has(> picture > img[data-ff-spot-id^="img-"]) {
    aspect-ratio: auto !important;
    padding-bottom: 0 !important;
  }

  /* 🆕 Phase 1B : média RECONSTRUIT (vidéo/iframe/embed). Doit GAGNER sur la
     règle générique ci-dessus (même spécificité → placé après) pour ne pas
     s'effondrer. On garde le ratio 16/9 et une vraie largeur. */
  video[data-ff-converted],
  iframe[data-ff-converted] {
    display: block !important;
    width: 100% !important;
    height: auto !important;
    max-width: 100% !important;
    max-height: none !important;
    aspect-ratio: 16 / 9 !important;
    object-fit: contain !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  img[data-ff-converted] {
    display: block !important;
    max-width: 100% !important;
    height: auto !important;
  }
</style>`;

  const editModeOnlyStyle = editMode
    ? `
<style id="ff-edit-mode-only">
  [data-ff-spot-id]:hover {
    outline: 2px dashed rgba(251, 191, 36, 0.8) !important;
    outline-offset: 3px !important;
    cursor: pointer !important;
    background-color: rgba(251, 191, 36, 0.05) !important;
  }
  [data-ff-link-id]:hover {
    outline: 2px dashed rgba(110, 231, 183, 0.9) !important;
    outline-offset: 3px !important;
    cursor: pointer !important;
  }

  [data-ff-active="true"] {
    outline: 3px solid rgba(251, 191, 36, 0.95) !important;
    outline-offset: 4px !important;
    background-color: rgba(251, 191, 36, 0.08) !important;
  }
  [data-ff-link-id][data-ff-active="true"] {
    outline: 3px solid rgba(110, 231, 183, 1) !important;
    background-color: rgba(110, 231, 183, 0.08) !important;
  }

  img[data-ff-spot-id]:hover,
  video[data-ff-spot-id]:hover,
  iframe[data-ff-spot-id]:hover {
    outline: 2px dashed rgba(139, 92, 246, 0.9) !important;
    outline-offset: 3px !important;
    cursor: pointer !important;
  }
  img[data-ff-spot-id][data-ff-active="true"],
  video[data-ff-spot-id][data-ff-active="true"],
  iframe[data-ff-spot-id][data-ff-active="true"] {
    outline: 3px solid rgba(139, 92, 246, 1) !important;
    outline-offset: 4px !important;
  }

  body { cursor: crosshair; }

  body[data-ff-bg-flash="true"]::after {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 2147483646;
    box-shadow: inset 0 0 0 4px rgba(251, 191, 36, 0.85);
    animation: ff-bg-flash 0.6s ease-out forwards;
  }
  @keyframes ff-bg-flash {
    0%   { opacity: 1; }
    100% { opacity: 0; }
  }
</style>`
    : "";

  // ───────────────────────────────────────────────────────────────────
  // FAQ runtime : UNIQUEMENT en mode public (aperçu non-éditable).
  // Identique au script injecté à l'export dans lib/export/faq-script.ts.
  // ───────────────────────────────────────────────────────────────────
  const faqRuntimeScript = !editMode
    ? `
<script>
(function(){
  if (window.__ffFaqBooted) return;
  window.__ffFaqBooted = true;

  function findAnswerFor(q){
    var n = q.nextElementSibling;
    while(n){
      if(n.tagName && n.tagName.toLowerCase()==='div') return n;
      n = n.nextElementSibling;
    }
    return null;
  }

  function setOpen(q, a, open){
    if(!a) return;
    if(open){
      a.style.setProperty('display','block','important');
      a.style.setProperty('visibility','visible','important');
      a.style.setProperty('opacity','1','important');
      a.style.setProperty('height','auto','important');
      a.style.setProperty('max-height','none','important');
      a.style.setProperty('min-height','0','important');
      a.style.setProperty('overflow','visible','important');
      a.style.setProperty('clip','auto','important');
      a.style.setProperty('clip-path','none','important');
      a.style.setProperty('transform','none','important');
      a.style.setProperty('pointer-events','auto','important');
      q.setAttribute('data-ff-faq-open','true');
      var i = q.querySelector('i[class*="fa-chevron"]');
      if(i){
        i.classList.remove('fa-chevron-circle-down');
        i.classList.add('fa-chevron-circle-up');
      }
    } else {
      a.style.setProperty('display','none','important');
      a.style.setProperty('height','0','important');
      a.style.setProperty('max-height','0','important');
      a.style.setProperty('overflow','hidden','important');
      q.setAttribute('data-ff-faq-open','false');
      var i2 = q.querySelector('i[class*="fa-chevron"]');
      if(i2){
        i2.classList.remove('fa-chevron-circle-up');
        i2.classList.add('fa-chevron-circle-down');
      }
    }
  }

  function bindAll(){
    var bound = 0;
    var icons = document.querySelectorAll('i[class*="fa-chevron-circle"]');
    for(var k=0; k<icons.length; k++){
      var icon = icons[k];
      var q = icon.parentElement;
      if(!q) continue;
      if(q.getAttribute('data-ff-faq-question')==='true') continue;
      var a = findAnswerFor(q);
      if(!a) continue;
      q.setAttribute('data-ff-faq-question','true');
      q.style.cursor = 'pointer';
      setOpen(q, a, false);
      (function(qq, aa){
        qq.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          var open = qq.getAttribute('data-ff-faq-open')==='true';
          setOpen(qq, aa, !open);
        });
      })(q, a);
      bound++;
    }

    // 🆕 Fallback générique (markup systeme.io sans icône chevron) : on lie les
    // éléments « question » (texte court terminé par ?) à leur réponse (bloc
    // frère plus long), et on les replie par défaut → accordéon cliquable.
    function findAnswerLenient(q){
      var n = q.nextElementSibling;
      while(n){
        var nt = (n.textContent||'').trim();
        if(nt.length >= 40) return n;
        n = n.nextElementSibling;
      }
      // sinon : frère suivant du parent
      var p = q.parentElement;
      if(p && p.nextElementSibling){
        var pt = (p.nextElementSibling.textContent||'').trim();
        if(pt.length >= 40) return p.nextElementSibling;
      }
      return null;
    }
    var cands = document.querySelectorAll('p,div,h3,h4,h5,strong,span');
    for(var j=0; j<cands.length; j++){
      var cq = cands[j];
      if(cq.getAttribute('data-ff-faq-question')==='true') continue;
      if(cq.children.length > 3) continue;
      var qt = (cq.textContent||'').trim();
      if(!(qt.length > 4 && qt.length < 200 && /\\?\\s*$/.test(qt))) continue;
      var ca = findAnswerLenient(cq);
      if(!ca) continue;
      var cat = (ca.textContent||'').trim();
      if(!(cat.length >= 40 && cat.length > qt.length && cat !== qt)) continue;
      cq.setAttribute('data-ff-faq-question','true');
      cq.style.cursor = 'pointer';
      setOpen(cq, ca, false);
      (function(qq, aa){
        qq.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          var open = qq.getAttribute('data-ff-faq-open')==='true';
          setOpen(qq, aa, !open);
        });
      })(cq, ca);
      bound++;
    }

    if(bound>0){
      try{ console.log('[FAQ-preview] bound', bound, 'questions'); }catch(e){}
    }
    return bound;
  }

  function boot(){ bindAll(); }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
  setTimeout(boot, 300);
  setTimeout(boot, 800);
  setTimeout(boot, 1500);
  setTimeout(boot, 3000);

  try{
    var obs = new MutationObserver(function(){ boot(); });
    obs.observe(document.body, { childList:true, subtree:true });
    setTimeout(function(){ try{ obs.disconnect(); }catch(e){} }, 10000);
  }catch(e){}
})();
</script>`
    : "";

  const editModeFlag = editMode ? "true" : "false";
  const interactivityScript = `
<script>
(function() {
  var EDIT_MODE = ${editModeFlag};
  var SECTION_ID = ${JSON.stringify(sectionId)};

  function neutralizeHiddenInlineStyles() {
    // En mode public, on NE neutralise PAS les max-height:0 car
    // ils peuvent être légitimes (FAQ fermées par défaut, etc.).
    if (!EDIT_MODE) return;
    var selectors = [
      '[style*="max-height: 0"]',
      '[style*="max-height:0"]',
      '[style*="opacity: 0"]',
      '[style*="opacity:0"]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(function(el) {
      var s = el.getAttribute('style') || '';
      s = s.replace(/max-height\\s*:\\s*0[a-z%]*\\s*;?/gi, '');
      s = s.replace(/opacity\\s*:\\s*0\\s*;?/gi, '');
      s = s.replace(/transform\\s*:\\s*translate[^;]*;?/gi, '');
      s = s.replace(/transform\\s*:\\s*scale\\(0[^)]*\\)\\s*;?/gi, '');
      el.setAttribute('style', s.trim());
    });
  }

  function setupLinks() {
    document.querySelectorAll('a[href]').forEach(function(a) {
      if (a.__ffLinkBound) return;
      a.__ffLinkBound = true;
      var href = a.getAttribute('href') || '';

      if (EDIT_MODE) {
        a.setAttribute('data-ff-href', href);
        a.removeAttribute('href');
        a.removeAttribute('target');
        a.style.cursor = 'pointer';
      } else {
        if (href.startsWith('http') || href.startsWith('//')) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      }
    });
  }

  function setupDetails() {
    // En mode public, on laisse les <details> fermés par défaut.
    if (!EDIT_MODE) return;
    document.querySelectorAll('details').forEach(function(d) {
      d.setAttribute('open', '');
    });
  }

  function setupFaqGridUnfreeze() {
    // En mode public, on NE défige PAS les grilles : on laisse le
    // layout d'origine pour ne pas casser l'affichage.
    if (!EDIT_MODE) return;
    var grids = document.querySelectorAll('div, section, ul');
    var unfrozen = 0;
    for (var i = 0; i < grids.length && unfrozen < 50; i++) {
      var g = grids[i];
      if (g.__ffFaqUnfrozen) continue;
      var cs = getComputedStyle(g);
      if (cs.display !== 'grid') continue;
      if (g.children.length < 2) continue;

      var rows = cs.gridTemplateRows || '';
      var pxRows = rows.match(/\\d+px/g) || [];
      var hasRepeatedPxRows =
        pxRows.length >= 2 &&
        pxRows.every(function(v) { return v === pxRows[0]; });

      var childrenWithQ = 0;
      for (var k = 0; k < g.children.length; k++) {
        var txt = (g.children[k].textContent || '').trim();
        if (txt.indexOf('?') !== -1) childrenWithQ++;
      }
      var faqLike = childrenWithQ >= Math.ceil(g.children.length / 2);

      if (hasRepeatedPxRows && faqLike) {
        g.setAttribute('data-ff-faq-grid', 'unfrozen');
        g.__ffFaqUnfrozen = true;
        unfrozen++;
      }
    }
    if (unfrozen > 0) {
      console.log('[FF faq] ' + unfrozen + ' grid(s) FAQ unfrozen.');
    }
  }

  function setupMediaWrapperRelease() {
    var medias = document.querySelectorAll(
      'img[data-ff-spot-id^="img-"], img[data-ff-image-id], ' +
      'video[data-ff-spot-id^="img-"], video[data-ff-image-id]'
    );
    var released = 0;
    medias.forEach(function(media) {
      if (media.__ffMediaReleased) return;
      media.__ffMediaReleased = true;

      var cur = media.parentElement;
      for (var i = 0; i < 3 && cur; i++) {
        try {
          var cs = getComputedStyle(cur);
          var hasFixedHeight =
            /^[0-9.]+px$/.test(cs.height) ||
            (cs.aspectRatio && cs.aspectRatio !== 'auto') ||
            (cs.paddingBottom && /^[0-9.]+%$/.test(cs.paddingBottom));
          if (hasFixedHeight) {
            cur.style.setProperty('height', 'auto', 'important');
            cur.style.setProperty('min-height', '0', 'important');
            cur.style.setProperty('max-height', 'none', 'important');
            cur.style.setProperty('aspect-ratio', 'auto', 'important');
            cur.style.setProperty('padding-bottom', '0', 'important');
            released++;
          }
        } catch (e) {}
        cur = cur.parentElement;
      }
    });
    if (released > 0) {
      console.log('[FF media] ' + released + ' wrapper(s) released.');
    }
  }

  function setupClickToEdit() {
    if (!EDIT_MODE) return;
    if (document.__ffClickBound) return;
    document.__ffClickBound = true;

    function findSpot(target, e) {
      var spot = target.closest && target.closest('[data-ff-spot-id], [data-ff-link-id]');
      if (spot) return spot;

      if (target.querySelectorAll && e) {
        var cx = e.clientX;
        var cy = e.clientY;
        var candidates = target.querySelectorAll('[data-ff-spot-id], [data-ff-link-id]');
        var best = null;
        var bestArea = Infinity;
        for (var i = 0; i < candidates.length; i++) {
          var el = candidates[i];
          var r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
            var area = r.width * r.height;
            if (area < bestArea) {
              bestArea = area;
              best = el;
            }
          }
        }
        return best;
      }
      return null;
    }

    function dispatchEdit(spot) {
      var prev = document.querySelector('[data-ff-active="true"]');
      if (prev) prev.removeAttribute('data-ff-active');
      spot.setAttribute('data-ff-active', 'true');

      var spotId = spot.getAttribute('data-ff-spot-id');
      var linkId = spot.getAttribute('data-ff-link-id');
      var tag = spot.tagName.toLowerCase();

      if (spotId && /^img-/.test(spotId)) {
        var currentSrc = '';
        var currentAlt = '';
        var mediaType = 'image';
        if (tag === 'img') {
          currentSrc = spot.getAttribute('src') || '';
          currentAlt = spot.getAttribute('alt') || '';
          mediaType = 'image';
        } else if (tag === 'video') {
          currentSrc = spot.getAttribute('src') ||
            (spot.querySelector('source') && spot.querySelector('source').getAttribute('src')) || '';
          currentAlt = spot.getAttribute('poster') || '';
          mediaType = 'video';
        } else if (tag === 'iframe') {
          currentSrc = spot.getAttribute('src') || '';
          currentAlt = spot.getAttribute('title') || '';
          mediaType = 'embed';
        }
        try { console.log('[FF media-click] tag=' + tag + ' | mediaType=' + mediaType + ' | spotId=' + spotId + ' | src=' + currentSrc); } catch (e) {}
        window.parent.postMessage({
          type: 'ff-edit-click',
          sectionId: SECTION_ID,
          spotKind: 'image',
          spotId: spotId,
          mediaType: mediaType,
          currentSrc: currentSrc,
          currentAlt: currentAlt
        }, '*');
        return;
      }

      if (linkId) {
        var realHref = spot.getAttribute('data-ff-href') ||
                       spot.getAttribute('href') || '';
        window.parent.postMessage({
          type: 'ff-edit-click',
          sectionId: SECTION_ID,
          spotKind: 'link',
          spotId: linkId,
          currentLabel: spot.textContent || '',
          currentHref: realHref
        }, '*');
        return;
      }

      if (spotId) {
        // ─── Détection FAQ ───────────────────────────────────────────────
        // 1) Chemin historique : icône chevron en enfant direct → réponse dans
        //    le div frère suivant.
        // 2) 🆕 Fallback générique (markup systeme.io sans chevron) : si la
        //    question ressemble à une question (texte court terminé par « ? »),
        //    on cherche la réponse = le PROCHAIN spot texte plus long, dans le
        //    même conteneur d'item FAQ ou son frère suivant.
        var answerSpotId = null;
        var isFaqQuestion = false;
        try {
          var chevron = spot.querySelector(
            ':scope > i[class*="fa-chevron-circle"], :scope > i[class*="fa-chevron"], ' +
            ':scope > i[class*="chevron"], :scope > i[class*="arrow"], ' +
            ':scope > i[class*="plus"], :scope > svg'
          );
          if (chevron) {
            var sib = spot.nextElementSibling;
            while (sib) {
              if (sib.tagName && sib.tagName.toLowerCase() === 'div') {
                var innerSpot = sib.querySelector('[data-ff-spot-id]');
                if (innerSpot) {
                  answerSpotId = innerSpot.getAttribute('data-ff-spot-id');
                  isFaqQuestion = true;
                }
                break;
              }
              sib = sib.nextElementSibling;
            }
          }

          // Fallback heuristique
          if (!answerSpotId) {
            var qText = (spot.textContent || '').trim();
            var looksLikeQuestion = qText.length > 4 && qText.length < 200 && /\\?\\s*$/.test(qText);
            if (looksLikeQuestion) {
              // Conteneur d'item FAQ : ancêtre proche au "look" FAQ, sinon parent.
              var container = spot.closest('[class*="faq" i],[class*="accordion" i],[class*="question" i],[class*="toggle" i],[class*="collaps" i],[class*="item" i]') || spot.parentElement;
              var scopes = [];
              if (container) { scopes.push(container); if (container.nextElementSibling) scopes.push(container.nextElementSibling); }
              for (var si = 0; si < scopes.length && !answerSpotId; si++) {
                var spots = scopes[si].querySelectorAll('[data-ff-spot-id]');
                for (var k = 0; k < spots.length; k++) {
                  var cand = spots[k];
                  if (cand === spot) continue;
                  var ct = (cand.textContent || '').trim();
                  // La réponse : plus longue que la question, et différente.
                  if (ct.length >= 40 && ct.length > qText.length && ct !== qText) {
                    answerSpotId = cand.getAttribute('data-ff-spot-id');
                    isFaqQuestion = true;
                    break;
                  }
                }
              }
            }
          }
        } catch (err) {}

        window.parent.postMessage({
          type: 'ff-edit-click',
          sectionId: SECTION_ID,
          spotKind: 'text',
          spotId: spotId,
          currentText: spot.textContent || '',
          answerSpotId: answerSpotId,
          isFaqQuestion: isFaqQuestion
        }, '*');
      }
    }

    function blockNavigation(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    document.addEventListener('mousedown', blockNavigation, true);
    document.addEventListener('auxclick', blockNavigation, true);

    document.addEventListener('click', function(e) {
      var spot = findSpot(e.target, e);
      if (spot) {
        e.preventDefault();
        e.stopPropagation();
        dispatchEdit(spot);
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      var prevActive = document.querySelectorAll('[data-ff-active="true"]');
      for (var i = 0; i < prevActive.length; i++) {
        prevActive[i].removeAttribute('data-ff-active');
      }

      try {
        document.body.setAttribute('data-ff-bg-flash', 'true');
        setTimeout(function() {
          document.body.removeAttribute('data-ff-bg-flash');
        }, 600);
      } catch (err) {}

      window.parent.postMessage({
        type: 'ff-edit-background',
        sectionId: SECTION_ID
      }, '*');
    }, true);

    document.addEventListener('submit', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }, true);
  }

  function setupParentMessageListener() {
    if (!EDIT_MODE) return;
    window.addEventListener('message', function(ev) {
      var data = ev && ev.data;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'ff-highlight-spot') return;
      var attr = data.attr === 'data-ff-link-id' ? 'data-ff-link-id' : 'data-ff-spot-id';
      var id = data.spotId;
      if (!id) return;
      try {
        var prev = document.querySelectorAll('[data-ff-active="true"]');
        for (var i = 0; i < prev.length; i++) prev[i].removeAttribute('data-ff-active');
        var sel = '[' + attr + '="' + String(id).replace(/"/g, '\\\\"') + '"]';
        var el = document.querySelector(sel);
        if (!el) return;
        el.setAttribute('data-ff-active', 'true');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {}
    }, false);
  }

  // 🔒 Sécurité #1b : l'iframe n'a plus « allow-same-origin » (sandbox
  // durci), donc le parent ne peut plus lire iframe.contentDocument pour
  // mesurer la hauteur réelle du contenu. On mesure ICI, à l'intérieur de
  // l'iframe, et on remonte la valeur au parent via postMessage. Logique
  // de mesure identique à l'ancienne measureContentHeight() côté parent :
  // body.scrollHeight complété par le bas des enfants directs réellement
  // dans le flux (on ignore le conteneur d'overlays hors-flux
  // data-ff-overlays, sinon un popup positionné loin regonfle la hauteur).
  function measureContentHeight() {
    var body = document.body;
    if (!body) return 0;
    var h = body.scrollHeight;
    var children = body.children;
    for (var i = 0; i < children.length; i++) {
      var el = children[i];
      if (el.hasAttribute && el.hasAttribute('data-ff-overlays')) continue;
      var rect = el.getBoundingClientRect();
      if (rect.height > 0) h = Math.max(h, Math.ceil(rect.bottom));
    }
    return h;
  }

  var __ffHeightRO = null;
  function reportHeight() {
    try {
      var h = measureContentHeight();
      if (h > 0) {
        window.parent.postMessage({ type: 'ff-height', sectionId: SECTION_ID, height: h }, '*');
      }
    } catch (e) {}
  }

  function setupHeightReporting() {
    reportHeight();
    if (!__ffHeightRO) {
      try {
        __ffHeightRO = new ResizeObserver(function() { reportHeight(); });
        __ffHeightRO.observe(document.body);
      } catch (e) {}
    }
  }

  function init() {
    try { neutralizeHiddenInlineStyles(); } catch(e) {}
    try { setupLinks(); } catch(e) {}
    try { setupDetails(); } catch(e) {}
    try { setupFaqGridUnfreeze(); } catch(e) {}
    try { setupMediaWrapperRelease(); } catch(e) {}
    try { setupClickToEdit(); } catch(e) {}
    try { setupParentMessageListener(); } catch(e) {}
    try { setupHeightReporting(); } catch(e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 500);
  setTimeout(init, 2000);
  setTimeout(reportHeight, 300);
  setTimeout(reportHeight, 1500);

  window.addEventListener('load', function() {
    reportHeight();
    setTimeout(reportHeight, 300);
    setTimeout(reportHeight, 1500);
  });

  document.addEventListener('load', function(e) {
    var t = e.target;
    if (t && (t.tagName === 'IMG' || t.tagName === 'VIDEO') &&
        (t.hasAttribute('data-ff-spot-id') || t.hasAttribute('data-ff-image-id'))) {
      try { setupMediaWrapperRelease(); } catch (err) {}
      try { reportHeight(); } catch (err) {}
    }
  }, true);
})();
</script>`;

  // 🆕 Phase 1C : modules de features (détection au rendu → rétrocompatible
  // avec les clones existants). FAQ reste géré par faqRuntimeScript ci-dessus ;
  // les modules ajoutent WhatsApp flottant, header sticky, etc.
  const features = detectFeatures(innerHtml);
  const { css: featureCss, script: featureScript } = buildFeatureRuntime(
    features,
    { editMode },
  );

  // 🆕 Bug fond noir (généralisé) : sur beaucoup de pages clonées (ex. systeme.io),
  // <html>/<body> sont TRANSPARENTS et seules certaines sections peignent leur
  // propre fond. Dans un vrai navigateur, le fond transparent laisse voir le
  // « canvas » par défaut = BLANC. Mais ici chaque section est isolée dans une
  // iframe posée sur le thème SOMBRE de l'app → le fond paraissait noir et le
  // texte noir devenait illisible. On rétablit donc le blanc par défaut du
  // navigateur sur html/body. Placé AVANT clonedHead et SANS !important : c'est
  // la priorité la plus basse → tout fond réellement capturé (`__ff-captured-page-bg`,
  // en !important), toute règle du site, et tout fond de section le surchargent.
  // N'a d'effet que lorsque rien d'autre ne peint le fond.
  const defaultCanvasStyle = `<style id="ff-default-canvas">html,body{background-color:#ffffff;}</style>`;

  return `<!DOCTYPE html>
<html>
<head>
${defaultCanvasStyle}
${head}
${desktopForceStyle}
${revealHiddenStyle}
${faqFixStyle}
${mediaFixStyle}
${editModeOnlyStyle}
${featureCss}
</head>
${buildBodyTag(clonedBody)}
${innerHtml}
${interactivityScript}
${faqRuntimeScript}
${featureScript}
</body>
</html>`;
}
