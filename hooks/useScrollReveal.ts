"use client";

import { useEffect, useRef } from "react";

/**
 * Hook : observe les éléments [data-ff-anim] dans le container et leur
 * ajoute .ff-anim-active + .ff-in quand ils entrent dans le viewport visible
 * du scroll root (preview desktop / preview mobile / viewport global).
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>() {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function findScrollRoot(el: HTMLElement | null): HTMLElement | null {
      let node: HTMLElement | null = el?.parentElement ?? null;
      while (node && node !== document.body && node !== document.documentElement) {
        const cs = window.getComputedStyle(node);
        const oy = cs.overflowY;
        if (
          (oy === "auto" || oy === "scroll" || oy === "overlay") &&
          node.scrollHeight > node.clientHeight + 1
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    const tplEl = container.querySelector<HTMLElement>("[data-ff-template]");
    const animationsOff =
      tplEl?.getAttribute("data-ff-animations") === "off";

    const collect = () =>
      Array.from(container.querySelectorAll<HTMLElement>("[data-ff-anim]"));

    const activate = (el: HTMLElement) => {
      el.classList.remove("ff-anim-pending");
      el.classList.add("ff-anim-active", "ff-in");
    };

    if (prefersReduced || animationsOff || typeof IntersectionObserver === "undefined") {
      collect().forEach(activate);
      return;
    }

    const scrollRoot = findScrollRoot(container);

    // Calcule la zone réellement visible du scroll root.
    const getViewportRect = () => {
      if (scrollRoot) return scrollRoot.getBoundingClientRect();
      const w = window.innerWidth || document.documentElement.clientWidth;
      const h = window.innerHeight || document.documentElement.clientHeight;
      return { top: 0, left: 0, bottom: h, right: w } as DOMRect;
    };

    const isVisibleNow = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const vp = getViewportRect();
      // L'élément doit recouper la fenêtre visible (pas juste le DOM du scroll).
      return (
        r.bottom > vp.top + 4 &&
        r.top < vp.bottom - 4 &&
        r.right > vp.left &&
        r.left < vp.right
      );
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.05) {
            activate(entry.target as HTMLElement);
            observer.unobserve(entry.target);
          }
        }
      },
      {
        root: scrollRoot,
        rootMargin: "0px 0px -8% 0px",
        threshold: [0, 0.1, 0.25],
      },
    );

    const observed = new WeakSet<Element>();

    const prep = (el: HTMLElement) => {
      if (observed.has(el)) return;
      observed.add(el);

      // Si l'élément est DÉJÀ visible à l'écran maintenant => on l'active
      // immédiatement (above-the-fold). Sinon on le met en "pending" et on
      // laisse l'IntersectionObserver le déclencher au scroll.
      if (isVisibleNow(el)) {
        activate(el);
      } else {
        el.classList.add("ff-anim-pending");
        observer.observe(el);
      }
    };

    const scan = () => {
      collect().forEach((el) => {
        if (!el.classList.contains("ff-anim-active")) prep(el);
      });
    };

    // Premier passage après que le layout soit stable.
    requestAnimationFrame(() => {
      requestAnimationFrame(scan);
    });

    // Re-scan si l'éditeur modifie le DOM.
    const mo = new MutationObserver(() => scan());
    mo.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mo.disconnect();
    };
  }, []);

  return containerRef;
}
