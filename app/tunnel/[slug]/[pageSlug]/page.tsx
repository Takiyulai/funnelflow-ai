// app/tunnel/[slug]/[pageSlug]/page.tsx — pages secondaires du funnel publié
import { notFound } from "next/navigation";
import { getPublishedFunnelBySlug } from "@/lib/funnels/loadPublished";
import { getPageBySlug } from "@/lib/funnels/types";
import { resolvePublicCustomCode } from "@/lib/funnels/customCode";
import { CustomCodeBlock } from "@/components/funnel/CustomCodeBlock";
import PublishedFunnelView from "../PublishedFunnelView";

// 🆕 CORRECTIF FIABILITÉ PUBLICATION — pages secondaires DYNAMIQUES (lecture
// fraîche), comme la home publique. Évite qu'un 404 mis en cache avant la
// publication reste « collé » alors que le tunnel est publié.
export const dynamic = "force-dynamic";

export default async function PublishedFunnelSubPage({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const { slug, pageSlug } = await params;
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

  return (
    <>
      <CustomCodeBlock code={customCode?.head ?? null} zone="head" />
      <PublishedFunnelView funnel={published.funnel} activePage={page} />
      <CustomCodeBlock code={customCode?.body ?? null} zone="body" />
    </>
  );
}
