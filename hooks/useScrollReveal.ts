"use client";

import { useEffect, useRef } from "react";

/**
 * Hook : observe un container et passe les éléments [data-ff-anim]
 * de "ff-anim-pending" à "ff-anim-active" lorsqu'ils entrent dans le viewport.
 *
 * Usage :
 *   const ref = useScrollReveal<HTMLDivElement>();
 *   return <div ref={ref}>...sections animées...</div>;
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>() {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Si l'utilisateur préfère réduire les animations, on active tout d'office.
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const targets = Array.from(
      container.querySelectorAll<HTMLElement>("[data-ff-anim]")
    );

    targets.forEach((el) => {
      el.classList.add("ff-anim-pending");
    });

    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => {
        el.classList.remove("ff-anim-pending");
        el.classList.add("ff-anim-active");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.classList.remove("ff-anim-pending");
            el.classList.add("ff-anim-active");
            observer.unobserve(el);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );

    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return containerRef;
}
