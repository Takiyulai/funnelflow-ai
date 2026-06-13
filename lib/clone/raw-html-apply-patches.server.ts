// lib/clone/raw-html-apply-patches.server.ts
import "server-only";
import { JSDOM } from "jsdom";
import type { RawHtmlPatch, ApplyPatchesOptions } from "./raw-html-apply-patches";

// On réimporte la logique pure depuis le fichier principal,
// mais on lui fournit un document via jsdom.
export function applyRawHtmlPatchesServer(
  html: string,
  patches: RawHtmlPatch | undefined,
  options: ApplyPatchesOptions = {},
): string {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body><div id="ff-root">${html}</div></body></html>`,
  );

  // Expose temporairement document/HTMLElement comme globals pour que
  // la fonction existante (qui utilise document) fonctionne.
  const prevDocument = (globalThis as any).document;
  const prevHTMLElement = (globalThis as any).HTMLElement;
  const prevNode = (globalThis as any).Node;

  (globalThis as any).document = dom.window.document;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  (globalThis as any).Node = dom.window.Node;

  try {
    // Import dynamique pour éviter tout side-effect au chargement
    const { applyRawHtmlPatches } = require("./raw-html-apply-patches") as typeof import("./raw-html-apply-patches");
    return applyRawHtmlPatches(html, patches, options);
  } finally {
    (globalThis as any).document = prevDocument;
    (globalThis as any).HTMLElement = prevHTMLElement;
    (globalThis as any).Node = prevNode;
  }
}
