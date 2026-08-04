// lib/clone/accordion-runtime.ts
/**
 * Runtime ACCORDÉON/FAQ partagé — source unique de vérité.
 *
 * ── POURQUOI CE FICHIER ────────────────────────────────────────────────────
 * Le clonage retire tous les <script> de la page source (sécurité + sandbox).
 * Or la quasi-totalité des constructeurs de pages (Divi, Elementor, Bootstrap,
 * systeme.io, ClickFunnels…) construisent leurs FAQ en DEUX temps :
 *   1. le HTML contient question + réponse ;
 *   2. une CLASSE CSS masque la réponse (`display:none`) ;
 *   3. leur JS bascule cette classe au clic.
 * En supprimant le JS, on garde donc l'étape 2 pour toujours : les réponses
 * sont invisibles ET rien ne réagit au clic.
 *
 * Ce runtime rebranche l'accordéon sans réintroduire le JS du site source.
 *
 * ── POURQUOI IL EST PARTAGÉ ────────────────────────────────────────────────
 * Il existait DEUX copies divergentes de cette logique :
 *   - components/funnel/sections/RawHtmlRenderer.tsx (aperçu)
 *   - lib/export/faq-script.ts (export HTML)
 * La copie de l'aperçu avait reçu un repli heuristique que l'export n'a jamais
 * eu → une FAQ pouvait marcher à l'aperçu et être morte à l'export. Les deux
 * importent désormais CE fichier.
 *
 * ── CAS RÉELS COUVERTS ─────────────────────────────────────────────────────
 * 1. Divi (`.et_pb_toggle`) — titre en <h5>, AUCUNE icône enfant (l'icône est
 *    un pseudo-élément), réponse masquée par `.et_pb_toggle_close
 *    .et_pb_toggle_content{display:none}`. Les deux anciens chemins de
 *    détection échouaient.
 * 2. Questions décorées d'emoji : « ¿CUÁNTO TIEMPO…? 👇 ». L'ancien test
 *    `/\?\s*$/` échouait sur les 7 questions d'une page réelle, car l'emoji
 *    vient APRÈS le point d'interrogation.
 * 3. Espagnol : « ¿…? » — on accepte aussi l'ouverture par « ¿ ».
 */

/**
 * Adaptateurs structurels par constructeur.
 * Ordre = priorité. Un item déjà lié n'est jamais relié.
 */
const BUILDER_ADAPTERS = [
  // Divi (WordPress) — le plus fréquent sur les pages clonées.
  {
    name: "divi",
    item: ".et_pb_toggle",
    title: ".et_pb_toggle_title",
    content: ".et_pb_toggle_content",
    openClass: "et_pb_toggle_open",
    closeClass: "et_pb_toggle_close",
  },
  // Elementor — accordéon ET toggle partagent les mêmes classes internes.
  {
    name: "elementor",
    item: ".elementor-accordion-item, .elementor-toggle-item",
    title: ".elementor-tab-title",
    content: ".elementor-tab-content",
    openClass: "elementor-active",
    closeClass: "",
  },
  // Bootstrap 5
  {
    name: "bootstrap",
    item: ".accordion-item",
    title: ".accordion-button, .accordion-header",
    content: ".accordion-collapse, .accordion-body",
    openClass: "show",
    closeClass: "collapse",
  },
  // Beaver Builder / génériques nommés
  {
    name: "generic-named",
    item: ".faq-item, .fl-accordion-item, .accordion-item, .qa-item",
    title:
      ".faq-question, .fl-accordion-button, .accordion-title, .accordion-header, .qa-question, h3, h4, h5",
    content:
      ".faq-answer, .fl-accordion-content, .accordion-content, .accordion-body, .qa-answer",
    openClass: "is-open",
    closeClass: "",
  },
] as const;

/**
 * Le corps du runtime, en JS ES5 (il tourne dans une iframe sandboxée et dans
 * l'export statique — pas de transpilation disponible).
 *
 * ⚠️ Ce contenu est un template literal TypeScript : toute séquence `\u`, `\s`,
 * `\?` destinée au code final devrait être doublée. On a donc délibérément
 * banni les expressions régulières de ce runtime — la comparaison de codes de
 * caractères évite à la fois ce piège d'échappement et le risque de
 * backtracking (cf. stripTrailingDecoration).
 */
const RUNTIME_BODY = `
(function () {
  if (window.__ffAccordionBooted) return;
  window.__ffAccordionBooted = true;

  var ADAPTERS = ${JSON.stringify(BUILDER_ADAPTERS)};

  // ── Détection « est-ce une question ? » ────────────────────────────────
  // Tolère la décoration finale : emoji, flèches, espaces insécables, tirets.
  // Sans ça, « ¿CUÁNTO TIEMPO…? 👇 » n'était pas reconnu (l'emoji suit le « ? »).
  //
  // ⚠️ Volontairement SANS expression régulière. Une première version utilisait
  // /(?:[\\uD800-\\uDFFF][\\uDC00-\\uDFFF]?|[…])+$/ : les alternatives s'y
  // recouvrent (\\uDC00-\\uDFFF est inclus dans \\uD800-\\uDFFF, et \\s recouvre
  // l'espace et \\u00A0), ce qui rend le nombre de découpages possibles
  // exponentiel. Sur un texte long ne se terminant PAS par une décoration, le
  // moteur partait en backtracking et FIGEAIT l'onglet (constaté en test).
  // Le balayage ci-dessous est strictement linéaire.
  function isDecorationCode(c) {
    if (c === 0x20 || c === 0x09 || c === 0x0A || c === 0x0D || c === 0xA0) return true; // espaces
    if (c === 0xFE0F || c === 0x200D) return true;              // variation selector, ZWJ
    if (c >= 0x2190 && c <= 0x2BFF) return true;                // flèches & symboles
    if (c >= 0x2600 && c <= 0x27BF) return true;                // dingbats / emoji BMP
    if (c === 0x2D || c === 0x2013 || c === 0x2014) return true; // - – —
    if (c === 0x3A || c === 0x3B || c === 0x2E) return true;     // : ; .
    return false;
  }

  function stripTrailingDecoration(t) {
    var s = String(t == null ? '' : t);
    var i = s.length;
    while (i > 0) {
      var code = s.charCodeAt(i - 1);
      // Emoji hors BMP : paire de substitution (2 unités de code).
      if (code >= 0xDC00 && code <= 0xDFFF && i >= 2) {
        var hi = s.charCodeAt(i - 2);
        if (hi >= 0xD800 && hi <= 0xDBFF) { i -= 2; continue; }
      }
      if (isDecorationCode(code)) { i -= 1; continue; }
      break;
    }
    return s.slice(0, i);
  }

  function looksLikeQuestion(t) {
    var raw = String(t == null ? '' : t).trim();
    if (raw.length <= 4 || raw.length >= 220) return false;
    var c = stripTrailingDecoration(raw);
    if (!c) return false;
    var last = c.charCodeAt(c.length - 1);
    // « ? » latin (0x3F) ou pleine chasse (0xFF1F), OU ouverture espagnole « ¿ ».
    return last === 0x3F || last === 0xFF1F || raw.charCodeAt(0) === 0x00BF;
  }

  // ── Ouverture / fermeture ─────────────────────────────────────────────
  // On pilote par style inline (marche partout, même sans le CSS du site) ET
  // on bascule la classe du constructeur pour que ses propres affordances
  // (rotation de flèche, couleur de fond) suivent.
  function setOpen(q, a, open, adapter) {
    if (!a) return;
    if (open) {
      a.style.setProperty('display', 'block', 'important');
      a.style.setProperty('visibility', 'visible', 'important');
      a.style.setProperty('opacity', '1', 'important');
      a.style.setProperty('height', 'auto', 'important');
      a.style.setProperty('max-height', 'none', 'important');
      a.style.setProperty('min-height', '0', 'important');
      a.style.setProperty('overflow', 'visible', 'important');
      a.style.setProperty('clip', 'auto', 'important');
      a.style.setProperty('clip-path', 'none', 'important');
      a.style.setProperty('transform', 'none', 'important');
      a.style.setProperty('pointer-events', 'auto', 'important');
    } else {
      a.style.setProperty('display', 'none', 'important');
      a.style.setProperty('height', '0', 'important');
      a.style.setProperty('max-height', '0', 'important');
      a.style.setProperty('overflow', 'hidden', 'important');
    }
    q.setAttribute('data-ff-faq-open', open ? 'true' : 'false');

    // Icône Font Awesome (systeme.io / ClickFunnels)
    var i = q.querySelector('i[class*="fa-chevron"]');
    if (i) {
      if (open) {
        i.classList.remove('fa-chevron-circle-down');
        i.classList.add('fa-chevron-circle-up');
      } else {
        i.classList.remove('fa-chevron-circle-up');
        i.classList.add('fa-chevron-circle-down');
      }
    }

    // Classes du constructeur, portées par le CONTENEUR d'item.
    if (adapter && (adapter.openClass || adapter.closeClass)) {
      var host = q.__ffItem || q.parentElement;
      if (host && host.classList) {
        if (adapter.openClass) host.classList.toggle(adapter.openClass, open);
        if (adapter.closeClass) host.classList.toggle(adapter.closeClass, !open);
      }
    }
    if (a.setAttribute) a.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (q.setAttribute) q.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function bind(q, a, adapter, startOpen) {
    if (!q || !a) return false;
    if (q.getAttribute('data-ff-faq-question') === 'true') return false;
    q.setAttribute('data-ff-faq-question', 'true');
    q.style.cursor = 'pointer';
    setOpen(q, a, !!startOpen, adapter);
    q.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      setOpen(q, a, q.getAttribute('data-ff-faq-open') !== 'true', adapter);
    });
    return true;
  }

  // ── 1. Adaptateurs structurels (Divi, Elementor, Bootstrap…) ──────────
  function bindByAdapters() {
    var bound = 0;
    for (var ai = 0; ai < ADAPTERS.length; ai++) {
      var ad = ADAPTERS[ai];
      var items;
      try { items = document.querySelectorAll(ad.item); } catch (e) { continue; }
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.__ffAccBound) continue;
        var q, a;
        try {
          q = it.querySelector(ad.title);
          a = it.querySelector(ad.content);
        } catch (e) { continue; }
        if (!q || !a || q === a || q.contains(a)) continue;
        it.__ffAccBound = true;
        q.__ffItem = it;
        if (bind(q, a, ad, false)) bound++;
      }
    }
    return bound;
  }

  // ── 2. <details> natifs : déjà interactifs, on n'y touche pas ──────────

  // ── 3. Icône chevron : question = parent de l'icône, réponse = div frère ─
  function findAnswerFor(q) {
    var n = q.nextElementSibling;
    while (n) {
      if (n.tagName && n.tagName.toLowerCase() === 'div') return n;
      n = n.nextElementSibling;
    }
    return null;
  }

  function bindByChevron() {
    var bound = 0;
    var icons = document.querySelectorAll('i[class*="fa-chevron-circle"]');
    for (var k = 0; k < icons.length; k++) {
      var q = icons[k].parentElement;
      if (!q) continue;
      var a = findAnswerFor(q);
      if (bind(q, a, null, false)) bound++;
    }
    return bound;
  }

  // ── 4. Repli heuristique (markup anonyme) ─────────────────────────────
  function findAnswerLenient(q) {
    var n = q.nextElementSibling;
    while (n) {
      if ((n.textContent || '').trim().length >= 40) return n;
      n = n.nextElementSibling;
    }
    var p = q.parentElement;
    if (p && p.nextElementSibling &&
        (p.nextElementSibling.textContent || '').trim().length >= 40) {
      return p.nextElementSibling;
    }
    return null;
  }

  function bindByHeuristic() {
    var bound = 0;
    var cands = document.querySelectorAll('p,div,h3,h4,h5,h6,strong,span,summary');
    for (var j = 0; j < cands.length; j++) {
      var q = cands[j];
      if (q.getAttribute('data-ff-faq-question') === 'true') continue;
      if (q.children.length > 3) continue;
      var qt = (q.textContent || '').trim();
      if (!looksLikeQuestion(qt)) continue;
      var a = findAnswerLenient(q);
      if (!a) continue;
      var at = (a.textContent || '').trim();
      if (at.length < 40 || at.length <= qt.length || at === qt) continue;
      if (bind(q, a, null, false)) bound++;
    }
    return bound;
  }

  function boot() {
    var n = 0;
    try { n += bindByAdapters(); } catch (e) {}
    try { n += bindByChevron(); } catch (e) {}
    try { n += bindByHeuristic(); } catch (e) {}
    if (n > 0) {
      try { console.log('[ff-accordion] ' + n + ' question(s) liée(s).'); } catch (e) {}
    }
    return n;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setTimeout(boot, 300);
  setTimeout(boot, 800);
  setTimeout(boot, 1500);
  setTimeout(boot, 3000);

  try {
    var obs = new MutationObserver(function () { boot(); });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { try { obs.disconnect(); } catch (e) {} }, 10000);
  } catch (e) {}
})();
`;

/** Balise <script> prête à injecter (aperçu public ET export HTML). */
export const ACCORDION_RUNTIME_SCRIPT = `<script>${RUNTIME_BODY}</script>`;

/**
 * CSS d'accompagnement pour le mode ÉDITION.
 *
 * En édition, on veut voir et cliquer TOUTES les réponses (pour les modifier) :
 * on neutralise donc les règles des constructeurs qui les masquent. Ciblage par
 * classes NOMMÉES uniquement — un sélecteur générique du type
 * `[class*="hide"]{opacity:1}` réveillerait aussi les boîtes d'alerte de
 * plugins (ex. « content is protected », masquée par `.hideme`).
 */
export const ACCORDION_EDIT_REVEAL_CSS = `
<style id="ff-accordion-edit-reveal">
  .et_pb_toggle_close .et_pb_toggle_content,
  .et_pb_toggle .et_pb_toggle_content,
  .elementor-accordion-item .elementor-tab-content,
  .elementor-toggle-item .elementor-tab-content,
  .accordion-item .accordion-collapse,
  .accordion-item .accordion-body,
  .fl-accordion-item .fl-accordion-content {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
</style>`;

/**
 * CSS de révélation des animations « au scroll ».
 *
 * Ces bibliothèques posent `opacity: 0` par une CLASSE, puis leur JS ajoute une
 * seconde classe au moment où l'élément entre dans le viewport. Le JS étant
 * retiré au clonage, l'élément reste invisible POUR TOUJOURS — il occupe sa
 * place mais ne s'affiche jamais.
 *
 * Cas réel : les 3 boutons `a.et_pb_button.et_animated` d'une page Divi,
 * hauteur 98 px chacun, `opacity: 0` — l'utilisateur voyait « un CTA non
 * cloné » alors qu'il était bien là, simplement transparent.
 *
 * ⚠️ Ciblage par classes NOMMÉES, jamais `[class*="anim"]` : trop large, et on
 * ne doit surtout pas révéler les boîtes masquées volontairement.
 */
export const SCROLL_ANIMATION_REVEAL_CSS = `
<style id="ff-scroll-anim-reveal">
  .et_animated,
  .wow,
  .sal-animate,
  .elementor-invisible,
  .js-scroll,
  .scroll-animate {
    opacity: 1 !important;
    visibility: visible !important;
    transform: none !important;
    animation-name: none !important;
  }
</style>`;
