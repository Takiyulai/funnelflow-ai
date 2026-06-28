// app/(app)/campagnes/page.tsx
// 🆕 « Campagnes » fusionné dans le module « Emails » (onglet Newsletter).
// On garde la route pour ne pas casser les liens/bookmarks → redirection.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CampagnesPage() {
  redirect("/emails?tab=newsletter");
}
