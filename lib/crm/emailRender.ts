// lib/crm/emailRender.ts
// 🆕 Rendu HTML d'un email (personnalisation + gabarit). Partagé par les
// séquences (et réutilisable ailleurs). Les newsletters gardent leur propre
// rendu interne pour ne rien casser.

export type EmailRecipient = { name?: string | null; email: string };

/** Remplace les variables {{prenom}}/{{name}}/{{email}} dans le contenu. */
export function personalize(content: string, r: EmailRecipient): string {
  const name = r.name || "";
  return content
    .replace(/\{\{\s*(prenom|name|nom)\s*\}\}/gi, name)
    .replace(/\{\{\s*email\s*\}\}/gi, r.email);
}

/** Convertit en corps HTML (laisse tel quel si déjà du HTML, sinon <p>/<br>). */
function toHtmlBody(text: string): string {
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Email complet (gabarit + personnalisation), prêt à envoyer via Resend. */
export function renderSequenceEmailHtml(content: string, r: EmailRecipient): string {
  const body = toHtmlBody(personalize(content, r));
  return (
    `<!doctype html><html><head><meta charset="utf-8" /></head>` +
    `<body style="margin:0;background:#f4f4f5;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#18181b;line-height:1.6;">` +
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">${body}</div>` +
    `</body></html>`
  );
}
