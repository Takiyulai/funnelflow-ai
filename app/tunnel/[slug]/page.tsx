// app/tunnel/[slug]/page.tsx — page d'entrée (home) du funnel publié
import { notFound } from "next/navigation";
import { getPublishedFunnelBySlug } from "@/lib/funnels/loadPublished";
import { getHomePage } from "@/lib/funnels/types";
import { resolvePublicCustomCode } from "@/lib/funnels/customCode";
import { CustomCodeBlock } from "@/components/funnel/CustomCodeBlock";
import PublishedFunnelView from "./PublishedFunnelView";

// 🆕 CORRECTIF FIABILITÉ PUBLICATION — la page publique est DYNAMIQUE (lecture
// fraîche de la base à chaque requête), comme les pages sœurs (merci/success/
// cancel). L'ISR précédent (revalidate=60) mettait en cache un 404 rendu AVANT
// la publication (ou pendant la fenêtre create→publish) ; si la revalidation
// on-demand échouait (session expirée → /api/revalidate-tunnel = 401), le slug
// restait 404 alors que le tunnel était bien publié — ce qui décrédibilise la
// plateforme. En dynamique, un tunnel publié est IMMÉDIATEMENT accessible et un
// 404 périmé ne peut plus « coller ». La lecture est une requête indexée unique
// (client admin). Le seul cas lent = cold start de la base (offre gratuite) →
// à traiter côté infra (garder la base active), pas par un cache qui masque les
// tunnels publiés.
export const dynamic = "force-dynamic";

export default async function PublishedFunnelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const published = await getPublishedFunnelBySlug(slug);
  if (!published) notFound();

  // 🆕 Rendu unifié via FunnelPreview (parité exacte avec l'aperçu).
  const home = getHomePage(published.funnel);

  // 🆕 VAGUE CUSTOM-CODE — Résolu CÔTÉ SERVEUR (kill switch + plan Agency du
  // propriétaire + taille). null pour tout autre plan, quoi que contienne le JSON.
  const customCode = await resolvePublicCustomCode(published.funnel, published.ownerId);

  return (
    <>
      <CustomCodeBlock code={customCode?.head ?? null} zone="head" />
      <PublishedFunnelView funnel={published.funnel} activePage={home} />
      <CustomCodeBlock code={customCode?.body ?? null} zone="body" />
    </>
  );
}
