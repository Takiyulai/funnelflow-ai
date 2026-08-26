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

    const applyStagger = (el: HTMLElement) => {
      const index = Number.parseInt(
        el.getAttribute("data-ff-anim-index") || "0",
        10,
      );
      const delay = Number.isFinite(index)
        ? Math.min(Math.max(index, 0) * 90, 360)
        : 0;
      el.style.setProperty("--ff-anim-delay", `${delay}ms`);
    };

    const activate = (el: HTMLElement) => {
      applyStagger(el);
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

    /** 🆕 Un élément est « atteint » quand il est visible OU déjà dépassé par
     *  le scroll (au-dessus de la ligne de flottaison). Tout ce qui est
     *  STRICTEMENT sous la ligne de flottaison ne l'est pas et doit garder son
     *  animation d'entrée. */
    const isReached = (el: HTMLElement, scrollRoot: HTMLElement | null) => {
      const r = el.getBoundingClientRect();
      const vp = getViewportRect(scrollRoot);
      return r.top < vp.bottom - 4;
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
      applyStagger(el);
      // 🆕 FIX « aperçu vide au changement de template » : au re-render React
      // (changement de template/variant → MÊMES nœuds DOM réutilisés), React
      // réécrit `className` avec la valeur rendue, ce qui EFFACE nos classes
      // impératives ff-anim-active/ff-in → l'élément repasse en opacity:0.
      // L'ancien garde `observed.has(el)` bloquait alors toute re-préparation :
      // l'élément restait invisible jusqu'à un remontage complet (toggle
      // desktop→mobile→desktop). On re-prépare donc TOUT élément dont les
      // classes ont disparu, même déjà vu.
      const hasState =
        el.classList.contains("ff-anim-active") ||
        el.classList.contains("ff-anim-pending");
      if (observed.has(el) && hasState) return;
      observed.add(el);

      if (isVisibleNow(el, scrollRoot)) {
        activate(el);
      } else {
        el.classList.add("ff-anim-pending");
        observer?.observe(el);
      }
    };

    // 🆕 FIX « tunnels statiques » : le filet de sécurité révélait AUTREFOIS
    // TOUS les éléments 1,2 s après le montage — y compris ceux situés des
    // milliers de pixels sous la ligne de flottaison. Résultat : au moment où
    // l'utilisateur scrollait, tout était déjà révélé et plus rien n'animait.
    // Le filet ne révèle désormais que ce qui est ATTEINT par le scroll
    // (visible ou dépassé) : la garantie « jamais d'écran vide » est conservée,
    // et le contenu sous la ligne de flottaison garde son animation d'entrée.
    const forceReached = () => {
      const scrollRoot = getScrollRoot();
      collect().forEach((el) => {
        if (el.classList.contains("ff-anim-active")) return;
        if (isReached(el, scrollRoot)) activate(el);
      });
    };

    let failsafeTimer: ReturnType<typeof setTimeout> | null = null;
    const armFailsafe = () => {
      if (failsafeTimer) clearTimeout(failsafeTimer);
      failsafeTimer = setTimeout(forceReached, 1200);
    };

    const scan = () => {
      const scrollRoot = getScrollRoot();
      if (!observer) buildObserver(scrollRoot);
      let leftPending = false;
      collect().forEach((el) => {
        if (!el.classList.contains("ff-anim-active")) {
          prep(el, scrollRoot);
          if (!el.classList.contains("ff-anim-active")) leftPending = true;
        }
      });
      if (leftPending) armFailsafe();
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

    // 🆕 Filet de sécurité ULTIME : au bout de 1.2s, on force l'activation des
    // éléments ATTEINTS par le scroll encore en pending. Cela évite un écran
    // vide si l'IntersectionObserver ne se déclenche pas, sans sacrifier
    // l'animation du contenu situé plus bas dans la page.
    timers.push(setTimeout(forceReached, 1200));

    // 🆕 Doublure au scroll (throttlée) : si l'IntersectionObserver est
    // indisponible ou muet (iframe exotique, vieux navigateur), le scroll
    // révèle quand même ce qui devient atteignable. S'auto-désactive dès qu'il
    // ne reste plus aucun élément en attente.
    let scrollTick: ReturnType<typeof setTimeout> | null = null;
    const scrollTargets: EventTarget[] = [window];
    const initialRoot = getScrollRoot();
    if (initialRoot) scrollTargets.push(initialRoot);

    const hasPending = () =>
      collect().some((el) => !el.classList.contains("ff-anim-active"));

    function onScroll() {
      if (scrollTick) return;
      scrollTick = setTimeout(() => {
        scrollTick = null;
        forceReached();
        if (!hasPending()) detachScroll();
      }, 250);
    }

    function detachScroll() {
      scrollTargets.forEach((t) => t.removeEventListener("scroll", onScroll));
    }

    scrollTargets.forEach((t) =>
      t.addEventListener("scroll", onScroll, { passive: true }),
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

    // Re-scan si l'éditeur modifie le DOM (changement de section, changement
    // de page, ajout de contenu…).
    // 🆕 FIX : les nœuds ajoutés étaient auparavant révélés INSTANTANÉMENT
    // (activate() direct), ce qui désactivait complètement l'animation au
    // scroll pour tout contenu qui apparaît APRÈS le montage initial — hors
    // du 1er chargement à froid, c'est le cas le plus fréquent (changement de
    // page dans l'éditeur/l'aperçu, ajout d'une section). `scan()` route
    // maintenant ces nouveaux nœuds par `prep()` : ceux déjà visibles à
    // l'écran s'affichent immédiatement (comportement WYSIWYG conservé),
    // ceux sous la ligne de flottaison sont mis en file et animés normalement
    // au scroll — le filet de sécurité à 1.2s reste en place si jamais
    // l'IntersectionObserver ne se déclenchait pas.
    // 🆕 FIX : on observe AUSSI les mutations d'attribut `class` — c'est le
    // signal du re-render React qui efface nos classes impératives (changement
    // de template dans le wizard, édition de section…). Sans ça, seul un
    // ajout/retrait de nœud déclenchait un re-scan, et un simple re-render
    // laissait tout l'aperçu invisible. Débouncé, et nos propres écritures de
    // classe (ff-anim-active déjà présent) ne re-déclenchent rien de coûteux :
    // scan() ignore les éléments déjà actifs.
    let moScanTimer: ReturnType<typeof setTimeout> | null = null;
    let lastScanAt = 0;
    const mo = new MutationObserver((mutations) => {
      // ⚠️ Filtre STRICT anti-tempête : on ne re-scanne QUE si
      //  - des nœuds ont été ajoutés/retirés (childList), OU
      //  - un élément [data-ff-anim] a PERDU ses classes d'état (le cas
      //    « re-render React efface ff-anim-active » → aperçu invisible).
      // Toute autre mutation de classe (activations par nos soins, tick d'un
      // timer, auto-scaling de headline, hover…) est ignorée — sinon chaque
      // frame déclenchait un scan + layout complet et gelait l'onglet.
      const relevant = mutations.some((m) => {
        if (m.type === "childList") {
          return m.addedNodes.length > 0 || m.removedNodes.length > 0;
        }
        const t = m.target as HTMLElement;
        return (
          t.hasAttribute?.("data-ff-anim") &&
          !t.classList.contains("ff-anim-active") &&
          !t.classList.contains("ff-anim-pending")
        );
      });
      if (!relevant) return;
      // Throttle dur : au plus un scan toutes les 300 ms.
      const wait = Math.max(60, 300 - (Date.now() - lastScanAt));
      if (moScanTimer) clearTimeout(moScanTimer);
      moScanTimer = setTimeout(() => {
        lastScanAt = Date.now();
        scan();
      }, wait);
    });
    mo.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-ff-anim", "data-ff-anim-index"],
    });

    // 🆕 Re-scan au resize (changement viewport mobile/desktop)
    const onResize = () => scan();
    window.addEventListener("resize", onResize);

    return () => {
      observer?.disconnect();
      mo.disconnect();
      rafs.forEach((id) => cancelAnimationFrame(id));
      timers.forEach((id) => clearTimeout(id));
      if (failsafeTimer) clearTimeout(failsafeTimer);
      if (moScanTimer) clearTimeout(moScanTimer);
      if (scrollTick) clearTimeout(scrollTick);
      detachScroll();
      window.removeEventListener("load", onLoad);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return containerRef;
}
