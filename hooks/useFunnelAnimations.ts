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
        // scrollé, layout figé), on révèle tout après un court délai pour ne
        // JAMAIS laisser le contenu invisible.
        const safety = window.setTimeout(() => {
          reveals.forEach((el) => el.classList.add("is-in"));
        }, 900);
        cleanups.push(() => window.clearTimeout(safety));
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
        const t = item.querySelector<HTMLElement>("[data-acc-toggle]");
        const pnl = item.querySelector<HTMLElement>("[data-acc-panel]");
        const c = item.querySelector<HTMLElement>("[data-acc-chev]");
        if (!t || !pnl) return;
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
        cleanups.push(() => t.removeEventListener("click", onClick));
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
