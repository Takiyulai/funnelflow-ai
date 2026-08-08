// tests/clone-media-fonts.test.ts
//
// Les POLICES ne sont pas des médias.
//
// ── L'INCIDENT ─────────────────────────────────────────────────────────────
// Sur une page réelle (delta360.io, builder LeadConnector), le collecteur de
// médias remontait 29 URLs. Ventilation constatée :
//   • 11 vraies images  (10 png + 1 webp)
//   • 18 POLICES        (6 eot, 3 woff2, 3 woff, 3 ttf, 3 svg de webfonts)
//
// Les 18 polices partaient chez Cloudinary en `resource_type: "image"`, qui
// les refusait toutes. Taux d'échec : 62 % — soit exactement 18/29. Le
// garde-fou de taux (>50 %) bloquait alors le clone entier.
//
// Ces 18 « échecs » n'en étaient pas : ces fichiers n'avaient rien à faire
// dans la liste. Ils sont servis par le CSS conservé dans `clonedHead`.
//
// La regex fautive attrape TOUS les `url()` d'une feuille de style, y compris
// ceux des blocs `@font-face` — pas seulement les `background-image`.

import { describe, it, expect } from "vitest";
import { parsePage } from "@/lib/clone/parser";

/** Reproduit la structure exacte relevée sur la page en cause. */
function pageWithFonts(): string {
  return `<!DOCTYPE html><html><head>
<style>
@font-face {
  font-family: 'FontAwesome';
  src: url('https://stcdn.leadconnectorhq.com/funnel/fontawesome/webfonts/fa-brands-400.eot');
  src: url('https://stcdn.leadconnectorhq.com/funnel/fontawesome/webfonts/fa-brands-400.eot?#iefix') format('embedded-opentype'),
       url('https://stcdn.leadconnectorhq.com/funnel/fontawesome/webfonts/fa-brands-400.woff2') format('woff2'),
       url('https://stcdn.leadconnectorhq.com/funnel/fontawesome/webfonts/fa-brands-400.woff') format('woff'),
       url('https://stcdn.leadconnectorhq.com/funnel/fontawesome/webfonts/fa-brands-400.ttf') format('truetype'),
       url('https://stcdn.leadconnectorhq.com/funnel/fontawesome/webfonts/fa-brands-400.svg#fontawesome') format('svg');
}
.hero { background-image: url('https://images.leadconnectorhq.com/hero.png'); }
</style>
</head><body>
<section>
  <h1>Titre de la page de vente</h1>
  <p>Un paragraphe suffisamment long pour que le bloc soit retenu comme section candidate par le parser.</p>
  <img src="https://images.leadconnectorhq.com/photo.webp" alt="Photo">
</section>
<section>
  <h2>Deuxième section</h2>
  <p>Encore du texte, pour que la stratégie de découpage retienne au moins deux blocs distincts.</p>
  <img src="https://images.leadconnectorhq.com/logo.png" alt="Logo">
</section>
</body></html>`;
}

describe("collecte des médias — exclusion des polices", () => {
  const parsed = parsePage(pageWithFonts(), "https://delta360.io/page");
  const urls = parsed.mediaAssets.map((a) => a.sourceUrl);

  it("ne collecte AUCUN fichier de police", () => {
    for (const url of urls) {
      expect(url, `police collectée : ${url}`).not.toMatch(/\.(eot|woff2?|ttf|otf)(\?|#|$)/i);
    }
  });

  it("écarte aussi les webfonts servies en SVG", () => {
    // FontAwesome sert ses polices en `.svg#fontawesome`. Une extension seule
    // ne suffit donc pas à les distinguer d'un vrai SVG décoratif : c'est le
    // segment /webfonts/ qui tranche.
    expect(urls.some((u) => u.includes("fa-brands-400.svg"))).toBe(false);
  });

  it("collecte bien les vraies images", () => {
    expect(urls.some((u) => u.endsWith("hero.png"))).toBe(true);
    expect(urls.some((u) => u.endsWith("photo.webp"))).toBe(true);
    expect(urls.some((u) => u.endsWith("logo.png"))).toBe(true);
  });

  it("ne collecte QUE les vraies images", () => {
    // Le cœur de la régression : 29 collectés au lieu de 11.
    expect(parsed.mediaAssets).toHaveLength(3);
  });

  it("n'écarte pas un SVG décoratif ordinaire", () => {
    // Le filtre ne doit pas devenir « tout .svg est une police ».
    const html = pageWithFonts().replace(
      "https://images.leadconnectorhq.com/logo.png",
      "https://images.leadconnectorhq.com/illustration.svg",
    );
    const out = parsePage(html, "https://delta360.io/page");
    expect(out.mediaAssets.some((a) => a.sourceUrl.endsWith("illustration.svg"))).toBe(true);
  });
});
