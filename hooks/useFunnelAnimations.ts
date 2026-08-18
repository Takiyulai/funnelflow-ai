"use client";

import { useEffect, type RefObject } from "react";

/**
 * Runtime d'animations pour les templates bespoke (reproduit le support.js des
 * exports Claude Design) : reveal au scroll, tilt 3D, parallax, accordéon FAQ,
 * compte à rebours. Fonctionne aussi bien quand le scroll est la fenêtre (page
 * publiée) que dans un conteneur interne (aperçu du wizard) : l'observer utilise
 * le parent scrollable détecté comme racine, avec un filet de sécurité qui
 * révèle tout au cas où. Cleanup complet au unmount.
 *
 * 🆕 Rendu data-driven : le DOM change au fil de l'édition (sections ajoutées,
 * re-montées, items FAQ créés…). Un MutationObserver re-câble tout (debounce)
 * quand des nœuds sont ajoutés/retirés, pour que les nouveaux [data-reveal],
 * [data-tilt], [data-faq-item] et [data-cd] restent fonctionnels sans reload.
 */
/* ------------------------------------------------------------------ */
/*  🆕 AUTO-INSTRUMENTATION DES BLOCS STANDARD                         */
/* ------------------------------------------------------------------ */
//
// ── LE BUG ──────────────────────────────────────────────────────────────────
// Ce runtime cherche des `[data-reveal]`. Or cet attribut n'était émis QUE par
// les 9 templates bespoke (components/funnel/templates/*) et les skins. Les
// blocs standard de components/funnel/sections/ n'en contenaient AUCUN, et le
// CSS `[data-reveal]{opacity:0}` vivait dans le <style> de chaque template,
// jamais en global. Un tunnel généré avec les blocs standard — le cas par
// défaut — n'avait donc strictement rien à animer : le hook s'exécutait, ne
// trouvait rien, et la page restait figée au scroll.
//
// ── LE CHOIX ────────────────────────────────────────────────────────────────
// Plutôt que d'ajouter `data-reveal` à la main dans chaque composant de
// section — invasif, et garanti d'être oublié au prochain bloc ajouté — on
// instrumente le DOM au moment du câblage. Un seul endroit, qui couvre les
// blocs actuels, ceux à venir, et le HTML cloné.
//
// ── LA SÉPARATION QUI COMPTE ────────────────────────────────────────────────
// Le CSS injecté cible `[data-auto-reveal]`, PAS `[data-reveal]`. Les
// templates bespoke gardent donc intégralement leur propre style : aucun
// risque de doubler ou d'écraser leurs transitions. Et une section qui
// contient déjà un `[data-reveal]` n'est jamais instrumentée.

const AUTO_STAGGER_MS = 90;
const AUTO_MAX_DELAY_MS = 360;
const REVEAL_STYLE_ID = "ff-auto-reveal-css";

/** Enfants éléments directs. */
function elementChildren(el: HTMLElement): HTMLElement[] {
  return Array.from(el.children).filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  );
}

/**
 * Injecte le CSS de révélation, une seule fois par document.
 *
 * Il vit ici et non dans globals.css pour rester solidaire du runtime : les
 * deux moitiés (attribut + transition) doivent arriver ensemble, sinon on
 * obtient soit du contenu invisible sans animation, soit l'inverse.
 */
function ensureRevealCss(root: HTMLElement): void {
  const doc = root.ownerDocument;
  if (!doc || doc.getElementById(REVEAL_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = REVEAL_STYLE_ID;
  style.textContent = [
    "[data-auto-reveal]{opacity:0;transform:translateY(24px);",
    "transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}",
    "[data-auto-reveal].is-in{opacity:1;transform:none}",
    // Respect de la préférence système : pas de mouvement, et surtout pas de
    // contenu bloqué à opacity 0 si le runtime ne s'exécutait pas.
    "@media (prefers-reduced-motion:reduce){",
    "[data-auto-reveal]{opacity:1;transform:none;transition:none}}",
  ].join("");
  (doc.head || doc.documentElement).appendChild(style);
}

/**
 * Marque les blocs standard pour qu'ils se révèlent au scroll.
 *
 * On descend d'un niveau tant qu'il n'y a qu'un seul enfant : les sections
 * sont souvent enveloppées dans un conteneur de largeur. Sans cette descente,
 * la section entière apparaîtrait d'un bloc au lieu de cascader.
 */
function autoInstrument(root: HTMLElement): void {
  // Le ref d'animation pointe souvent sur un conteneur d'habillage, pas
  // directement sur la liste des sections. Sans cette descente, ce conteneur
  // serait pris POUR une section : les vraies sections deviendraient ses
  // « enfants à cascader » et s'animeraient toutes ensemble au chargement,
  // au lieu de se révéler une par une au scroll.
  let host = root;
  let depth = 0;
  while (elementChildren(host).length === 1 && depth++ < 3) {
    const only = elementChildren(host)[0];
    if (elementChildren(only).length === 0) break;
    host = only;
  }

  for (const section of elementChildren(host)) {
    // Déjà animé (template bespoke, skin, HTML cloné instrumenté) : on ne
    // touche à rien. C'est ce test qui garantit la non-régression.
    if (section.hasAttribute("data-reveal") || section.querySelector("[data-reveal]")) {
      continue;
    }
    // Échappatoire explicite pour un bloc qui ne doit pas bouger.
    if (section.hasAttribute("data-no-reveal")) continue;

    let level: HTMLElement[] = elementChildren(section);
    let guard = 0;
    while (level.length === 1 && elementChildren(level[0]).length > 1 && guard++ < 3) {
      level = elementChildren(level[0]);
    }
    const targets = level.length > 0 ? level : [section];

    targets.forEach((el, i) => {
      el.setAttribute("data-reveal", "");
      el.setAttribute("data-auto-reveal", "");
      const delay = Math.min(i * AUTO_STAGGER_MS, AUTO_MAX_DELAY_MS);
      if (delay > 0) el.setAttribute("data-delay", String(delay));
    });
  }
}

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement || null;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll") return p;
    p = p.parentElement;
  }
  return null;
}

export function useFunnelAnimations(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let cleanups: Array<() => void> = [];
    const runCleanups = () => {
      cleanups.forEach((fn) => fn());
      cleanups = [];
    };

    const wire = () => {
      runCleanups();

      // 🆕 Instrumentation AVANT la collecte : sans elle, `reveals` est vide sur
      // tout tunnel construit avec les blocs standard, et la page reste figée.
      ensureRevealCss(root);
      autoInstrument(root);

      const reveals = Array.from(
        root.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)"),
      );

      // ── Reveal ──────────────────────────────────────────────────────────
      if (reduce) {
        reveals.forEach((el) => el.classList.add("is-in"));
      } else if (reveals.length) {
        const scrollRoot = getScrollParent(root);
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) {
                const d = parseInt(e.target.getAttribute("data-delay") || "0", 10);
                const target = e.target as HTMLElement;
                window.setTimeout(() => target.classList.add("is-in"), d);
                io.unobserve(e.target);
              }
            });
          },
          { root: scrollRoot, threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
        );
        reveals.forEach((el) => io.observe(el));
        cleanups.push(() => io.disconnect());
        // Filet de sécurité : si l'observer ne se déclenche pas (conteneur non
        // scrollé, layout figé), on révèle après un court délai pour ne JAMAIS
        // laisser du contenu invisible.
        // 🆕 FIX « aucune animation au scroll » : ce filet révélait AUTREFOIS
        // la page ENTIÈRE au bout de 900 ms, y compris tout ce qui se trouvait
        // sous la ligne de flottaison — donc plus rien n'animait au scroll. Il
        // ne révèle désormais que ce que le scroll a déjà atteint.
        const viewportBottom = () =>
          scrollRoot
            ? scrollRoot.getBoundingClientRect().bottom
            : window.innerHeight || document.documentElement.clientHeight;
        const revealReached = () => {
          const limit = viewportBottom();
          reveals.forEach((el) => {
            if (el.classList.contains("is-in")) return;
            if (el.getBoundingClientRect().top < limit - 4) {
              el.classList.add("is-in");
            }
          });
        };
        const safety = window.setTimeout(revealReached, 900);
        cleanups.push(() => window.clearTimeout(safety));

        // Doublure au scroll (throttlée) au cas où l'IntersectionObserver
        // resterait muet : garantit qu'aucun contenu atteint ne reste caché.
        const scroller: HTMLElement | Window = scrollRoot || window;
        let tick = 0;
        const onScrollSafety = () => {
          if (tick) return;
          tick = window.setTimeout(() => {
            tick = 0;
            revealReached();
          }, 250);
        };
        scroller.addEventListener("scroll", onScrollSafety, {
          passive: true,
        } as AddEventListenerOptions);
        cleanups.push(() => {
          scroller.removeEventListener("scroll", onScrollSafety);
          if (tick) window.clearTimeout(tick);
        });
      }

      // ── Tilt ────────────────────────────────────────────────────────────
      if (!reduce) {
        root.querySelectorAll<HTMLElement>("[data-tilt]").forEach((card) => {
          const inner = card.querySelector<HTMLElement>("[data-tilt-inner]") || card;
          const onMove = (ev: MouseEvent) => {
            const r = card.getBoundingClientRect();
            const px = (ev.clientX - r.left) / r.width - 0.5;
            const py = (ev.clientY - r.top) / r.height - 0.5;
            inner.style.transform =
              "perspective(900px) rotateX(" + (-py * 7).toFixed(2) + "deg) rotateY(" + (px * 9).toFixed(2) + "deg)";
          };
          const onLeave = () => {
            inner.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
          };
          card.addEventListener("mousemove", onMove);
          card.addEventListener("mouseleave", onLeave);
          cleanups.push(() => {
            card.removeEventListener("mousemove", onMove);
            card.removeEventListener("mouseleave", onLeave);
          });
        });
      }

      // ── Parallax ────────────────────────────────────────────────────────
      if (!reduce) {
        const pxEls = Array.from(root.querySelectorAll<HTMLElement>("[data-parallax]"));
        if (pxEls.length) {
          const scrollRoot = getScrollParent(root);
          const scroller: HTMLElement | Window = scrollRoot || window;
          const onScroll = () => {
            const vh = window.innerHeight;
            pxEls.forEach((el) => {
              const r = el.getBoundingClientRect();
              const off = r.top + r.height / 2 - vh / 2;
              const s = parseFloat(el.getAttribute("data-parallax") || "0.05") || 0.05;
              el.style.transform = "translate3d(0," + (-off * s).toFixed(1) + "px,0)";
            });
          };
          scroller.addEventListener("scroll", onScroll, { passive: true } as AddEventListenerOptions);
          onScroll();
          cleanups.push(() => scroller.removeEventListener("scroll", onScroll));
        }
      }

      // ── Accordéon FAQ ───────────────────────────────────────────────────
      root.querySelectorAll<HTMLElement>("[data-faq-item]").forEach((item) => {
        // 🆕 Anti-double-câblage : le runtime se ré-exécute (MutationObserver de
        // re-câblage). Sans ce garde, on rattachait un 2e (3e…) listener de clic
        // au MÊME item → chaque clic basculait l'accordéon plusieurs fois, et il
        // fallait cliquer plusieurs fois pour qu'il finisse par s'ouvrir.
        if (item.dataset.accWired === "1") return;
        const t = item.querySelector<HTMLElement>("[data-acc-toggle]");
        const pnl = item.querySelector<HTMLElement>("[data-acc-panel]");
        const c = item.querySelector<HTMLElement>("[data-acc-chev]");
        if (!t || !pnl) return;
        item.dataset.accWired = "1";
        const onClick = () => {
          const open = item.getAttribute("data-open") === "1";
          if (open) {
            pnl.style.maxHeight = "0px";
            item.setAttribute("data-open", "0");
            if (c) c.style.transform = "rotate(0deg)";
          } else {
            pnl.style.maxHeight = pnl.scrollHeight + "px";
            item.setAttribute("data-open", "1");
            if (c) c.style.transform = "rotate(180deg)";
          }
        };
        t.addEventListener("click", onClick);
        cleanups.push(() => {
          t.removeEventListener("click", onClick);
          delete item.dataset.accWired;
        });
      });

      // ── Countdown ───────────────────────────────────────────────────────
      const cd = root.querySelector<HTMLElement>("[data-cd]");
      if (cd) {
        const rawTarget = cd.getAttribute("data-target");
        let target: number;
        if (rawTarget) {
          const asNum = Number(rawTarget);
          target =
            Number.isFinite(asNum) && asNum > 0
              ? Date.now() + asNum * 1000
              : new Date(rawTarget).getTime();
          if (!Number.isFinite(target)) target = Date.now() + (2 * 86400 + 14 * 3600) * 1000;
        } else {
          target = Date.now() + (2 * 86400 + 14 * 3600) * 1000;
        }
        const set = (k: string, v: number) => {
          const el = root.querySelector<HTMLElement>("[data-cd-" + k + "]");
          if (!el) return;
          const s = String(v).padStart(2, "0");
          // nodeValue (characterData) et non textContent (childList) : évite de
          // déclencher le MutationObserver de re-câblage à chaque seconde.
          if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
            if (el.firstChild.nodeValue !== s) el.firstChild.nodeValue = s;
          } else {
            el.textContent = s;
          }
        };
        const tick = () => {
          let ms = target - Date.now();
          if (ms < 0) ms = 0;
          set("d", Math.floor(ms / 86400000));
          set("h", Math.floor(ms / 3600000) % 24);
          set("m", Math.floor(ms / 60000) % 60);
          set("s", Math.floor(ms / 1000) % 60);
        };
        tick();
        const id = window.setInterval(tick, 1000);
        cleanups.push(() => window.clearInterval(id));
      }
    };

    wire();

    // Re-câblage (debounce) quand le DOM change : ajout/retrait de sections,
    // items FAQ, re-montage React… Les mutations texte (frappe dans l'éditeur)
    // sont du characterData → ignorées (pas de re-câblage à chaque touche).
    let debounce = 0;
    const mo = new MutationObserver((muts) => {
      const structural = muts.some(
        (m) => m.type === "childList" && (m.addedNodes.length > 0 || m.removedNodes.length > 0),
      );
      if (!structural) return;
      window.clearTimeout(debounce);
      debounce = window.setTimeout(wire, 250);
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      window.clearTimeout(debounce);
      runCleanups();
    };
  }, [ref]);
}
