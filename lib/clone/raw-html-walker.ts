// lib/clone/raw-html-walker.ts
//
// Parcours DOM unifié pour l'édition de raw-html cloné.
// Source unique de vérité utilisée par :
//   - buildRawHtmlInventory (lib/clone/raw-html-editable.ts)
//   - applyRawHtmlPatches   (lib/clone/raw-html-apply-patches.ts)

// ───────────────────────────────────────────────────────────────────────────
// Types partagés
// ───────────────────────────────────────────────────────────────────────────

export type SpotKind = "text" | "link" | "image";

/**
 * Sous-type de média porté par un ImageSpot.
 * - "image" : balise <img>
 * - "video" : balise <video> (upload de fichier vidéo possible)
 * - "embed" : <iframe> vidéo (YouTube/Vimeo/Loom/Wistia) → édition par URL d'embed
 *
 * Le `kind` reste "image" (le pipeline d'édition média est unifié), mais
 * `mediaType` permet à l'éditeur d'ouvrir le bon flux (image vs vidéo vs embed).
 */
export type MediaType = "image" | "video" | "embed";

export type TextSubKind = "title" | "subtitle" | "paragraph" | "short";

export interface TextSpot {
  kind: "text";
  id: string;
  element: Element;
  subKind: TextSubKind;
  original: string;
  tag: string;
  hasInlineStyles: boolean;
  styledFragments: string[];
}

export interface LinkSpot {
  kind: "link";
  id: string;
  element: Element;
  href: string;
  label: string;
  isExternal: boolean;
  isCta: boolean;
}

export interface ImageSpot {
  kind: "image";
  id: string;
  element: Element;
  src: string;
  alt: string;
  /** 🆕 Phase 1B : distingue image / vidéo / embed pour ouvrir le bon éditeur. */
  mediaType: MediaType;
}

export type Spot = TextSpot | LinkSpot | ImageSpot;

export type SpotVisitor = (spot: Spot) => void;

// ───────────────────────────────────────────────────────────────────────────
// Constantes
// ───────────────────────────────────────────────────────────────────────────

const MAX_TEXTS = 1000;
const MAX_LINKS = 200;
const MAX_IMAGES = 200;
const MIN_TEXT_LEN = 2;
const MAX_TEXT_LEN = 1200;

const ATOMIC_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "li", "blockquote", "figcaption",
  "summary", "dt", "dd", "label", "caption",
  "th", "td",
]);

const INLINE_TAGS = new Set([
  "span", "strong", "em", "b", "i", "u", "small", "mark",
  "sub", "sup", "code", "kbd", "abbr", "cite", "q", "s",
  "del", "ins", "var", "time", "br",
]);

const SKIP_TAGS = new Set([
  "script", "style", "noscript", "template", "svg", "iframe",
  "video", "audio", "source", "track", "canvas", "object", "embed",
  "head", "meta", "link", "title",
]);

// ───────────────────────────────────────────────────────────────────────────
// Debug flag
// ───────────────────────────────────────────────────────────────────────────

export const walkerDebug = { enabled: false };

// ───────────────────────────────────────────────────────────────────────────
// Helpers exportés
// ───────────────────────────────────────────────────────────────────────────

export function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function makeTextId(original: string): string {
  return `t-${shortHash(original.toLowerCase())}`;
}

export function makeLinkId(href: string, label: string): string {
  return `a-${shortHash(`${href}::${label.toLowerCase()}`)}`;
}

export function makeImageId(src: string): string {
  return `img-${shortHash(src)}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers internes
// ───────────────────────────────────────────────────────────────────────────

function isInvisible(el: Element): boolean {
  if (el.hasAttribute("hidden")) return true;
  if (el.getAttribute("aria-hidden") === "true") return true;
  const style = el.getAttribute("style") || "";
  if (/display\s*:\s*none/i.test(style)) return true;
  if (/visibility\s*:\s*hidden/i.test(style)) return true;
  const cls = el.getAttribute("class") || "";
  if (/\bhidden\b|\bd-none\b|\bsr-only\b|\bvisually-hidden\b/.test(cls)) {
    return true;
  }
  return false;
}

function getDeepText(el: Element): string {
  return normalize(el.textContent || "");
}

function looksLikeCode(text: string): boolean {
  if (/\{[^}]*:[^}]*\}/.test(text)) return true;
  if (/[a-zA-Z-]+\s*:\s*[^;]+;/.test(text) && (text.match(/;/g) || []).length >= 2) return true;
  if (/\/\*[\s\S]*\*\//.test(text)) return true;
  if ((text.match(/#[0-9a-f]{3,8}\b/gi) || []).length >= 2) return true;
  if (/\b(transform|translate|opacity|transition|@keyframes|@media)\s*[:(]/i.test(text)) return true;
  if (/[#.][\w-]+\s*[,{]/.test(text)) return true;
  return false;
}

function classifyText(tag: string, text: string): TextSubKind {
  if (tag === "h1" || tag === "h2") return "title";
  if (tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") return "subtitle";
  if (tag === "li") return "short";
  if (text.length <= 40) return "short";
  return "paragraph";
}

function isCtaElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "button") return true;
  if (tag !== "a") return false;
  const cls = (el.getAttribute("class") || "").toLowerCase();
  if (/\b(btn|button|cta|call-to-action)\b/.test(cls)) return true;
  if (el.getAttribute("role") === "button") return true;
  return false;
}

function isInsideCtaOrLink(el: Element): Element | null {
  let cur: Element | null = el.parentElement;
  while (cur) {
    const tag = cur.tagName?.toLowerCase();
    if (tag === "a" || tag === "button") return cur;
    cur = cur.parentElement;
  }
  return null;
}

function containsLinkOrButton(el: Element): boolean {
  return el.querySelector("a, button") !== null;
}

function detectStyledFragments(el: Element): string[] {
  const fragments: string[] = [];
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();
    if (!INLINE_TAGS.has(tag)) continue;
    const style = child.getAttribute("style") || "";
    if (/color\s*:|background/i.test(style)) {
      const txt = normalize(child.textContent || "");
      if (txt) fragments.push(txt);
    }
  }
  return fragments;
}

// ───────────────────────────────────────────────────────────────────────────
// API principale : walkEditable
// ───────────────────────────────────────────────────────────────────────────

export function walkEditable(
  source: string | Element,
  visitor: SpotVisitor,
): void {
  if (typeof document === "undefined") return;

  let root: Element;
  if (typeof source === "string") {
    root = document.createElement("div");
    root.innerHTML = source;
  } else {
    root = source;
  }

  const seenLinkKeys = new Set<string>();
  const seenSpotIds = new Set<string>();

  let textCount = 0;
  let linkCount = 0;
  let imageCount = 0;
  let collisionCount = 0;

  function emit(spot: Spot): void {
    if (seenSpotIds.has(spot.id)) {
      const baseId = spot.id;
      let suffix = 2;
      let candidate = `${baseId}-${suffix}`;
      while (seenSpotIds.has(candidate)) {
        suffix++;
        candidate = `${baseId}-${suffix}`;
      }
      if (walkerDebug.enabled) {
        // eslint-disable-next-line no-console
        console.info(
          `[FF walker] Collision ID résolue : ${baseId} → ${candidate}`,
          spot.kind === "text" ? spot.original.slice(0, 60) : spot,
        );
      }
      spot.id = candidate;
      collisionCount++;
    }
    seenSpotIds.add(spot.id);
    visitor(spot);
  }

  function walk(el: Element, insideAtomic: boolean): void {
    if (
      textCount >= MAX_TEXTS &&
      linkCount >= MAX_LINKS &&
      imageCount >= MAX_IMAGES
    ) {
      return;
    }

    const tag = el.tagName.toLowerCase();

    if (SKIP_TAGS.has(tag)) return;
    if (isInvisible(el)) return;

    // ---- IMAGES & MÉDIAS ----
    if (tag === "img") {
      if (imageCount < MAX_IMAGES) {
        const src = el.getAttribute("src") || "";
        if (src && !src.startsWith("data:")) {
          emit({
            kind: "image",
            id: makeImageId(src),
            element: el,
            src,
            alt: el.getAttribute("alt") || "",
            mediaType: "image",
          });
          imageCount++;
        }
      }
      return;
    }

    if (tag === "video") {
      if (imageCount < MAX_IMAGES) {
        const directSrc = el.getAttribute("src") || "";
        const sourceEl = el.querySelector("source");
        const sourceSrc = sourceEl?.getAttribute("src") || "";
        const src = directSrc || sourceSrc;
        const poster = el.getAttribute("poster") || "";
        if (src && !src.startsWith("data:")) {
          emit({
            kind: "image",
            id: makeImageId(src),
            element: el,
            src,
            alt: poster,
            mediaType: "video",
          });
          imageCount++;
        }
      }
      return;
    }

    if (tag === "iframe") {
      const src = el.getAttribute("src") || "";
      const isVideoEmbed =
        /youtube\.com\/embed|youtu\.be|vimeo\.com|loom\.com|wistia/i.test(src);
      if (isVideoEmbed && imageCount < MAX_IMAGES) {
        emit({
          kind: "image",
          id: makeImageId(src),
          element: el,
          src,
          alt: el.getAttribute("title") || "",
          mediaType: "embed",
        });
        imageCount++;
      }
      return;
    }

    // ---- LINKS / BUTTONS ----
    if (tag === "a" || tag === "button") {
      const href = tag === "a" ? (el.getAttribute("href") || "") : "";
      const label = getDeepText(el);

      const isTechnicalHref =
        !href ||
        href === "#" ||
        href.startsWith("javascript:") ||
        href.startsWith("data:");

      // 🆕 Bug #9 : un CTA dont le href est technique (`#`, `javascript:`,
      // checkout/popup…) n'était PAS enregistré comme lien éditable → au clic,
      // on ne pouvait modifier QUE son texte, pas son URL de redirection. On
      // enregistre désormais TOUS les CTA/boutons (et les <a> à href technique
      // qui ressemblent à des CTA) pour qu'on puisse leur assigner une URL.
      const isCta = isCtaElement(el);
      const shouldRegister =
        linkCount < MAX_LINKS &&
        (tag === "button" ||
          isCta ||
          (!isTechnicalHref && label.length > 0));

      if (shouldRegister) {
        const key = `${tag}::${href}::${label}`;
        if (!seenLinkKeys.has(key)) {
          seenLinkKeys.add(key);
          emit({
            kind: "link",
            id: makeLinkId(href, label),
            element: el,
            href,
            label,
            isExternal: /^https?:\/\//i.test(href),
            isCta,
          });
          linkCount++;
        }
      }

      for (const child of Array.from(el.children)) {
        const childTag = child.tagName.toLowerCase();
        if (childTag === "img" || childTag === "picture" || childTag === "video") {
          walk(child, insideAtomic);
        }
      }
      return;
    }

    // ---- Inline à l'intérieur d'un atome déjà capturé ----
    if (insideAtomic && INLINE_TAGS.has(tag)) {
      for (const child of Array.from(el.children)) {
        walk(child, insideAtomic);
      }
      return;
    }

    // ---- ATOMIC_TAGS ----
    if (ATOMIC_TAGS.has(tag) && textCount < MAX_TEXTS) {
      if (containsLinkOrButton(el)) {
        for (const child of Array.from(el.children)) {
          const childTag = child.tagName.toLowerCase();
          if (childTag === "a" || childTag === "button") {
            walk(child, insideAtomic);
          } else {
            walk(child, false);
          }
        }
        return;
      }

      const fullText = getDeepText(el);
      if (
        fullText.length >= MIN_TEXT_LEN &&
        fullText.length <= MAX_TEXT_LEN &&
        !isInsideCtaOrLink(el) &&
        !looksLikeCode(fullText)
      ) {
        const styled = detectStyledFragments(el);
        emit({
          kind: "text",
          id: makeTextId(fullText),
          element: el,
          subKind: classifyText(tag, fullText),
          original: fullText,
          tag,
          hasInlineStyles: styled.length > 0,
          styledFragments: styled,
        });
        textCount++;
        for (const child of Array.from(el.children)) {
          walk(child, true);
        }
        return;
      }
    }

    // ---- <div> feuille textuelle ----
    if (tag === "div" && textCount < MAX_TEXTS) {
      if (containsLinkOrButton(el)) {
        for (const child of Array.from(el.children)) {
          walk(child, insideAtomic);
        }
        return;
      }

      const hasBlockChild = Array.from(el.children).some((c) => {
        const childTag = c.tagName.toLowerCase();
        return !INLINE_TAGS.has(childTag) && !SKIP_TAGS.has(childTag);
      });
      if (!hasBlockChild) {
        const fullText = getDeepText(el);
        if (
          fullText.length >= MIN_TEXT_LEN &&
          fullText.length <= MAX_TEXT_LEN &&
          !isInsideCtaOrLink(el) &&
          !looksLikeCode(fullText)
        ) {
          const styled = detectStyledFragments(el);
          emit({
            kind: "text",
            id: makeTextId(fullText),
            element: el,
            subKind: classifyText(tag, fullText),
            original: fullText,
            tag,
            hasInlineStyles: styled.length > 0,
            styledFragments: styled,
          });
          textCount++;
          for (const child of Array.from(el.children)) {
            walk(child, true);
          }
          return;
        }
      }
    }

    // ---- INLINE orphelin ----
    if (
      !insideAtomic &&
      INLINE_TAGS.has(tag) &&
      tag !== "br" &&
      textCount < MAX_TEXTS
    ) {
      if (!containsLinkOrButton(el) && !isInsideCtaOrLink(el)) {
        const fullText = getDeepText(el);
        if (
          fullText.length >= MIN_TEXT_LEN &&
          fullText.length <= MAX_TEXT_LEN &&
          !looksLikeCode(fullText)
        ) {
          const parentTag = el.parentElement?.tagName.toLowerCase() || "";
          const parentIsAtomic = ATOMIC_TAGS.has(parentTag);
          const parentIsInline = INLINE_TAGS.has(parentTag);

          const parentEl = el.parentElement;
          const parentHasSiblingLink = parentEl
            ? !!parentEl.querySelector(":scope > a, :scope > button")
            : false;
          const shouldCapture =
            (!parentIsAtomic && !parentIsInline) ||
            (parentIsAtomic && parentHasSiblingLink);

          if (shouldCapture) {
            const styled = detectStyledFragments(el);
            emit({
              kind: "text",
              id: makeTextId(fullText),
              element: el,
              subKind: classifyText(tag, fullText),
              original: fullText,
              tag,
              hasInlineStyles: styled.length > 0,
              styledFragments: styled,
            });
            textCount++;
            return;
          }
        }
      }
    }

    // Descente normale
    for (const child of Array.from(el.children)) {
      walk(child, insideAtomic);
    }
  }

  for (const child of Array.from(root.children)) {
    walk(child, false);
  }

  if (walkerDebug.enabled) {
    // eslint-disable-next-line no-console
    console.info(
      `[FF walker] Terminé — texts=${textCount}, links=${linkCount}, images=${imageCount}, collisions=${collisionCount}`,
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Helper : remplacement intelligent de texte (préserve les spans stylés)
// ───────────────────────────────────────────────────────────────────────────

export function replaceTextContentSmart(el: Element, newText: string): void {
  type StyledFragment = { element: Element; text: string };
  const styledFragments: StyledFragment[] = [];
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();
    if (!INLINE_TAGS.has(tag)) continue;
    const style = child.getAttribute("style") || "";
    if (/color\s*:|background/i.test(style)) {
      const txt = normalize(child.textContent || "");
      if (txt) styledFragments.push({ element: child, text: txt });
    }
  }

  // ─── Pas de fragment stylé : remplacement simple ───
  if (styledFragments.length === 0) {
    const hasStructuralChild = Array.from(el.children).some((c) => {
      const tag = c.tagName.toLowerCase();
      return tag === "img" || tag === "svg" || tag === "picture";
    });
    if (!hasStructuralChild) {
      el.textContent = newText;
      return;
    }
    const toRemove: ChildNode[] = [];
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3) {
        toRemove.push(node);
      } else if (node.nodeType === 1) {
        const tag = (node as Element).tagName.toLowerCase();
        if (INLINE_TAGS.has(tag)) toRemove.push(node);
      }
    }
    toRemove.forEach((n) => n.remove());
    el.insertBefore(document.createTextNode(newText), el.firstChild);
    return;
  }

  const newTextNorm = normalize(newText);
  const originalFullText = normalize(el.textContent || "");
  const allPresent = styledFragments.every((f) => newTextNorm.includes(f.text));

  // ─── ✨ CAS SPÉCIAL "full-span" ───
  // Tout le contenu original est dans un unique <span> stylé qui couvre
  // 100% du texte. On étend ce span au nouveau texte intégral plutôt
  // que de le restreindre au fragment original. Évite que la partie
  // ajoutée perde la couleur.
  if (
    styledFragments.length === 1 &&
    styledFragments[0].text === originalFullText
  ) {
    const span = styledFragments[0].element.cloneNode(false) as Element;
    span.textContent = newText;

    const structural: Node[] = [];
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 1) {
        const tag = (node as Element).tagName.toLowerCase();
        if (tag === "img" || tag === "svg" || tag === "picture") {
          structural.push(node);
        }
      }
    }
    while (el.firstChild) el.removeChild(el.firstChild);
    for (const s of structural) el.appendChild(s);
    el.appendChild(span);
    return;
  }

  // ─── Cas où le fragment original n'est plus présent ───
  if (!allPresent) {
    const firstStyle = styledFragments[0]?.element.getAttribute("style") || "";
    el.textContent = newText;
    if (firstStyle && /color\s*:/i.test(firstStyle)) {
      const existingStyle = el.getAttribute("style") || "";
      const colorMatch = firstStyle.match(/color\s*:\s*[^;]+/i);
      if (colorMatch && !/color\s*:/i.test(existingStyle)) {
        const sep = existingStyle && !existingStyle.trim().endsWith(";") ? "; " : "";
        el.setAttribute("style", `${existingStyle}${sep}${colorMatch[0]}`);
      }
    }
    return;
  }

  // ─── Cas standard : fragments stylés partiels présents dans le nouveau texte ───
  type FragPos = { fragment: StyledFragment; start: number; end: number };
  const positions: FragPos[] = [];
  let cursor = 0;
  for (const frag of styledFragments) {
    const idx = newTextNorm.indexOf(frag.text, cursor);
    if (idx === -1) {
      el.textContent = newText;
      return;
    }
    positions.push({ fragment: frag, start: idx, end: idx + frag.text.length });
    cursor = idx + frag.text.length;
  }

  const newChildren: Node[] = [];
  let prevEnd = 0;
  for (const pos of positions) {
    if (pos.start > prevEnd) {
      const before = newTextNorm.slice(prevEnd, pos.start);
      if (before) newChildren.push(document.createTextNode(before));
    }
    const span = pos.fragment.element.cloneNode(true) as Element;
    span.textContent = pos.fragment.text;
    newChildren.push(span);
    prevEnd = pos.end;
  }
  if (prevEnd < newTextNorm.length) {
    const after = newTextNorm.slice(prevEnd);
    if (after) newChildren.push(document.createTextNode(after));
  }

  const structural: Node[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 1) {
      const tag = (node as Element).tagName.toLowerCase();
      if (tag === "img" || tag === "svg" || tag === "picture") {
        structural.push(node);
      }
    }
  }

  while (el.firstChild) el.removeChild(el.firstChild);
  for (const s of structural) el.appendChild(s);
  for (const c of newChildren) el.appendChild(c);
}