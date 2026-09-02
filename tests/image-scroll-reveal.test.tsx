import { act, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScrollReveal } from "@/hooks/useScrollReveal";

function Preview({ animation = "fade-in", enabled = true }: { animation?: string; enabled?: boolean }) {
  const ref = useScrollReveal<HTMLDivElement>();
  return <div ref={ref}><div data-ff-template="cosmos-night" data-ff-animations={enabled ? "on" : "off"}>
    <figure key={animation} data-ff-anim={animation}>Image visible sans JavaScript</figure>
  </div></div>;
}

describe("apparition des images", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 10, bottom: 110, left: 10, right: 110, width: 100, height: 100, x: 10, y: 10, toJSON: () => ({}),
    });
    vi.stubGlobal("IntersectionObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("peint un état de départ avant de révéler une image déjà dans l'écran", async () => {
    const { container, rerender } = render(<Preview />);
    const figure = container.querySelector("figure")!;
    await act(async () => { vi.advanceTimersByTime(40); });
    expect(figure).toHaveClass("ff-anim-pending");
    expect(figure).not.toHaveClass("ff-anim-active");
    await act(async () => { vi.advanceTimersByTime(60); });
    expect(figure).toHaveClass("ff-anim-active");
    expect(figure).not.toHaveClass("ff-anim-pending");

    rerender(<Preview animation="slide-left" />);
    const replacement = container.querySelector("figure")!;
    expect(replacement).not.toBe(figure);
    await act(async () => { vi.advanceTimersByTime(700); });
    expect(replacement).toHaveClass("ff-anim-active");
    // Un simple scroll ne recommence pas l'animation d'un élément révélé.
    window.dispatchEvent(new Event("scroll"));
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(replacement).not.toHaveClass("ff-anim-pending");
  });

  it("ne masque rien quand le navigateur demande de réduire les animations", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const { container } = render(<Preview />);
    expect(container.querySelector("[data-ff-template]")).not.toHaveClass("ff-anim-ready");
    expect(container.querySelector("figure")).toHaveClass("ff-anim-active");
  });

  it("ne masque rien sans IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<Preview />);
    expect(container.querySelector("[data-ff-template]")).not.toHaveClass("ff-anim-ready");
  });

  it("permet de réactiver les animations globales sans remonter tout l'aperçu", async () => {
    const { container, rerender } = render(<Preview enabled={false} />);
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(container.querySelector("[data-ff-template]")).not.toHaveClass("ff-anim-ready");
    rerender(<Preview animation="zoom-in" enabled />);
    await act(async () => { vi.advanceTimersByTime(700); });
    expect(container.querySelector("[data-ff-template]")).toHaveClass("ff-anim-ready");
    expect(container.querySelector("figure")).toHaveClass("ff-anim-active");
  });

  it("laisse le HTML initial entièrement visible sans exécution JavaScript", () => {
    const html = renderToString(<Preview />);
    expect(html).toContain("Image visible sans JavaScript");
    expect(html).not.toContain("ff-anim-ready");
    expect(html).not.toContain("ff-anim-pending");
    expect(html).not.toContain("opacity:0");
  });
});
