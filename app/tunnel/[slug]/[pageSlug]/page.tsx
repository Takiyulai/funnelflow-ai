// app/tunnel/[slug]/[pageSlug]/page.tsx — pages secondaires du funnel publié
import { notFound } from "next/navigation";
import { getPublishedFunnelBySlug } from "@/lib/funnels/loadPublished";
import { getPageBySlug } from "@/lib/funnels/types";
import { resolvePublicCustomCode } from "@/lib/funnels/customCode";
import { CustomCodeBlock } from "@/components/funnel/CustomCodeBlock";
import { serveAbVariant } from "@/lib/ab/serve";
import PublishedFunnelView from "../PublishedFunnelView";

// 🆕 CORRECTIF FIABILITÉ PUBLICATION — pages secondaires DYNAMIQUES (lecture
// fraîche), comme la home publique. Évite qu'un 404 mis en cache avant la
// publication reste « collé » alors que le tunnel est publié.
export const dynamic = "force-dynamic";

export default async function PublishedFunnelSubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
  // 🆕 `ff_ab=a|b` force une variante pour APERÇU, sans compter la vue.
  searchParams: Promise<{ ff_ab?: string }>;
}) {
  const { slug, pageSlug } = await params;
  const sp = await searchParams;
  const forced = sp.ff_ab === "a" || sp.ff_ab === "b" ? sp.ff_ab : null;
  const published = await getPublishedFunnelBySlug(slug);
  if (!published) notFound();

  // pageSlug peut être "/" encodé ou un slug normal ; on tente match exact puis avec "/"
  const page =
    getPageBySlug(published.funnel, pageSlug) ??
    getPageBySlug(published.funnel, `/${pageSlug}`);
  if (!page) notFound();

  // 🆕 Rendu unifié via FunnelPreview (parité exacte avec l'aperçu).
  // 🆕 VAGUE CUSTOM-CODE — même résolution serveur que la page d'entrée.
  const customCode = await resolvePublicCustomCode(published.funnel, published.ownerId);

  // 🆕 MODULE 3 — Même résolution A/B que la page d'entrée : un test peut
  // porter sur n'importe quelle page du tunnel, pas seulement la première.
  const { page: activePage } = await serveAbVariant(
    published.funnelId,
    published.ownerId,
    page,
    forced,
  );

  return (
    <>
      <CustomCodeBlock code={customCode?.head ?? null} zone="head" />
      <PublishedFunnelView funnel={published.funnel} activePage={activePage} />
      <CustomCodeBlock code={customCode?.body ?? null} zone="body" />
    </>
  );
}
