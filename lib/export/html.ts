import { strToU8, zipSync } from "fflate";
import type { Funnel } from "@/lib/funnels/types";

function escapeHtml(value = "") {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  };
  return value.replace(/[&<>"']/g, (char) => entities[char] ?? char);
}

export function renderFunnelHtml(funnel: Funnel) {
  const css = renderFunnelCss(funnel);
  const sections = funnel.sections.map((section) => `
    <section class="ff-section ff-${section.type}">
      ${section.eyebrow ? `<p class="ff-eyebrow">${escapeHtml(section.eyebrow)}</p>` : ""}
      <h2>${escapeHtml(section.headline)}</h2>
      ${section.subheadline ? `<p class="ff-subheadline">${escapeHtml(section.subheadline)}</p>` : ""}
      ${section.body ? `<p>${escapeHtml(section.body)}</p>` : ""}
      ${section.bullets?.length ? `<ul>${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${section.cta ? `<a class="ff-button" href="#lead-form">${escapeHtml(section.cta)}</a>` : ""}
    </section>`).join("\n");

  return `<!doctype html>
<html lang="${funnel.language}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(funnel.seo.title)}</title>
  <meta name="description" content="${escapeHtml(funnel.seo.description)}" />
  <style>${css}</style>
</head>
<body>
  <main class="ff-page">
    ${sections}
    <section id="lead-form" class="ff-section ff-form">
      <h2>${funnel.language === "fr" ? "Recevoir les détails" : "Get the details"}</h2>
      <form>
        <input placeholder="${funnel.language === "fr" ? "Votre nom" : "Your name"}" />
        <input type="email" placeholder="Email" />
        <button class="ff-button" type="submit">${funnel.language === "fr" ? "Continuer" : "Continue"}</button>
      </form>
    </section>
  </main>
</body>
</html>`;
}

export function renderFunnelCss(funnel: Funnel) {
  return `
    :root { --primary:${funnel.design.primaryColor}; --gold:${funnel.design.secondaryColor}; --green:${funnel.design.accentColor}; --ink:#101828; --muted:#667085; --bg:#F8FAFC; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter, system-ui, sans-serif; color:var(--ink); background:var(--bg); }
    .ff-page { overflow:hidden; }
    .ff-section { padding:64px 20px; max-width:1040px; margin:0 auto; }
    .ff-hero { min-height:72vh; display:grid; align-content:center; }
    .ff-eyebrow { color:var(--green); font-weight:800; text-transform:uppercase; font-size:13px; }
    h2 { margin:0 0 16px; font-size:clamp(34px, 6vw, 72px); line-height:1.02; letter-spacing:0; }
    .ff-subheadline, p { font-size:18px; line-height:1.7; color:var(--muted); max-width:720px; }
    ul { display:grid; gap:10px; padding-left:20px; color:var(--ink); }
    li::marker { color:var(--green); }
    .ff-button { display:inline-flex; align-items:center; justify-content:center; min-height:48px; padding:0 22px; margin-top:18px; border-radius:8px; color:#082B4C; background:var(--gold); text-decoration:none; font-weight:800; }
    .ff-form { background:#fff; border:1px solid #E5E7EB; border-radius:8px; margin-bottom:48px; box-shadow:0 18px 55px rgba(8, 43, 76, 0.10); }
    form { display:grid; gap:12px; max-width:520px; }
    input { min-height:48px; border:1px solid #E5E7EB; border-radius:8px; padding:0 14px; font:inherit; }
    @media (min-width: 760px) { .ff-section { padding:88px 32px; } }
  `;
}

export function createSystemeBlocks(funnel: Funnel) {
  return funnel.sections.map((section) => ({
    label: section.headline,
    html: `<section style="padding:56px 20px;font-family:Inter,Arial,sans-serif;color:#101828;">
  ${section.eyebrow ? `<p style="color:#35B779;font-weight:800;text-transform:uppercase;">${escapeHtml(section.eyebrow)}</p>` : ""}
  <h2 style="font-size:42px;line-height:1.05;margin:0 0 14px;">${escapeHtml(section.headline)}</h2>
  ${section.subheadline ? `<p style="font-size:18px;line-height:1.7;color:#667085;">${escapeHtml(section.subheadline)}</p>` : ""}
  ${section.cta ? `<a href="#form" style="display:inline-block;background:#F4C542;color:#082B4C;padding:15px 22px;border-radius:8px;font-weight:800;text-decoration:none;">${escapeHtml(section.cta)}</a>` : ""}
</section>`
  }));
}

export function createImportGuide() {
  return [
    "1. Ouvrez Systeme.io et créez un nouveau tunnel.",
    "2. Ajoutez une page de capture ou de vente selon le template choisi.",
    "3. Ajoutez un bloc HTML personnalisé pour chaque section générée.",
    "4. Collez les blocs dans l’ordre recommandé.",
    "5. Remplacez les liens CTA par vos formulaires, pages de paiement ou rendez-vous.",
    "6. Testez la page sur mobile avant publication."
  ].join("\n");
}

export function createHtmlZipBase64(funnel: Funnel) {
  const html = renderFunnelHtml(funnel);
  const css = renderFunnelCss(funnel);
  const guide = createImportGuide();
  const zipped = zipSync({
    "index.html": strToU8(html),
    "styles.css": strToU8(css),
    "systeme-import-guide.txt": strToU8(guide)
  });
  return Buffer.from(zipped).toString("base64");
}
