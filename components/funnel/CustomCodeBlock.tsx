// components/funnel/CustomCodeBlock.tsx
// 🆕 VAGUE CUSTOM-CODE — Rendu d'une zone de code personnalisé sur une page
// de tunnel PUBLIÉE. Server Component : le HTML (scripts inclus) fait partie
// du flux HTML initial rendu par le serveur → les <script> s'exécutent
// nativement dans le navigateur (contrairement à un innerHTML posé au runtime).
//
// ⚠️ SÉCURITÉ — ce composant ne doit être rendu QUE par les pages publiques
// app/tunnel/[slug]/(page|[pageSlug]/page).tsx, et UNIQUEMENT avec un code déjà
// validé par lib/funnels/customCode.ts (kill switch + plan Agency + taille).
// Ne jamais l'utiliser dans le dashboard, l'éditeur ou /preview.
//
// `suppressHydrationWarning` : le code utilisateur peut muter son propre DOM
// (ex. GTM insère des iframes) — on ne veut pas que React s'en mêle.

export function CustomCodeBlock({
  code,
  zone,
}: {
  code: string | null;
  zone: "head" | "body";
}) {
  if (!code) return null;
  return (
    <div
      data-ff-custom-code={zone}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}
