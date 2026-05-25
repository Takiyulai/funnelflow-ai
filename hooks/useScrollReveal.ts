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

    if (tplEl) {
      tplEl.classList.add("ff-anim-ready");
    }

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

    // 🆕 Recalcule le scroll root à chaque scan (peut changer si le DOM
    // est encore en train de se stabiliser au premier rendu).
    const getScrollRoot = () => findScrollRoot(container);

    const getViewportRect = (scrollRoot: HTMLElement | null) => {
      if (scrollRoot) return scrollRoot.getBoundingClientRect();
      const w = window.innerWidth || document.documentElement.clientWidth;
      const h = window.innerHeight || document.documentElement.clientHeight;
      return { top: 0, left: 0, bottom: h, right: w } as DOMRect;
    };

    const isVisibleNow = (el: HTMLElement, scrollRoot: HTMLElement | null) => {
      const r = el.getBoundingClientRect();
      const vp = getViewportRect(scrollRoot);
      return (
        r.bottom > vp.top + 4 &&
        r.top < vp.bottom - 4 &&
        r.right > vp.left &&
        r.left < vp.right
      );
    };

    let observer: IntersectionObserver | null = null;

    const buildObserver = (scrollRoot: HTMLElement | null) => {
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && entry.intersectionRatio > 0.05) {
              activate(entry.target as HTMLElement);
              observer?.unobserve(entry.target);
            }
          }
        },
        {
          root: scrollRoot,
          rootMargin: "0px 0px -8% 0px",
          threshold: [0, 0.1, 0.25],
        },
      );
    };

    const observed = new WeakSet<Element>();

    const prep = (el: HTMLElement, scrollRoot: HTMLElement | null) => {
      if (observed.has(el)) return;
      observed.add(el);

      if (isVisibleNow(el, scrollRoot)) {
        activate(el);
      } else {
        el.classList.add("ff-anim-pending");
        observer?.observe(el);
      }
    };

    const scan = () => {
      const scrollRoot = getScrollRoot();
      if (!observer) buildObserver(scrollRoot);
      collect().forEach((el) => {
        if (!el.classList.contains("ff-anim-active")) prep(el, scrollRoot);
      });
    };

    // 🆕 Multi-passages : au premier mount, les dimensions ne sont pas
    // toujours stables (images en cours de chargement, polices custom,
    // transform: scale du desktop stage). On scanne plusieurs fois
    // pour rattraper les éléments above-the-fold qui auraient été ratés.
    const rafs: number[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    rafs.push(
      requestAnimationFrame(() => {
        rafs.push(requestAnimationFrame(scan));
      }),
    );
    timers.push(setTimeout(scan, 80));
    timers.push(setTimeout(scan, 250));
    timers.push(setTimeout(scan, 600));

    // 🆕 Filet de sécurité ULTIME : au bout de 1.2s, on force l'activation
    // de tous les éléments qui sont encore en pending. Cela évite un écran
    // vide définitif si jamais l'IntersectionObserver ne se déclenche pas.
    timers.push(
      setTimeout(() => {
        collect().forEach((el) => {
          if (!el.classList.contains("ff-anim-active")) {
            activate(el);
          }
        });
      }, 1200),
    );

    // 🆕 Re-scan au load complet (images + polices)
    const onLoad = () => scan();
    if (document.readyState !== "complete") {
      window.addEventListener("load", onLoad, { once: true });
    }

    // 🆕 Re-scan quand les polices custom finissent de charger
    if (typeof document !== "undefined" && (document as Document & { fonts?: FontFaceSet }).fonts) {
      (document as Document & { fonts: FontFaceSet }).fonts.ready
        .then(() => scan())
        .catch(() => {});
    }

    // Re-scan si l'éditeur modifie le DOM (changement de section, etc.)
    const mo = new MutationObserver(() => scan());
    mo.observe(container, { childList: true, subtree: true });

    // 🆕 Re-scan au resize (changement viewport mobile/desktop)
    const onResize = () => scan();
    window.addEventListener("resize", onResize);

    return () => {
      observer?.disconnect();
      mo.disconnect();
      rafs.forEach((id) => cancelAnimationFrame(id));
      timers.forEach((id) => clearTimeout(id));
      window.removeEventListener("load", onLoad);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return containerRef;
}
