// app/p/[slug]/page.tsx — page d'entrée (home) du funnel publié
import { notFound } from "next/navigation";
import { getPublishedFunnelBySlug } from "@/lib/funnels/loadPublished";
import { renderFunnelHtml } from "@/lib/export/html";
import { getHomePage } from "@/lib/funnels/types";
import PublicFunnelRuntime from "@/components/funnel/PublicFunnelRuntime";

export const dynamic = "force-dynamic";

export default async function PublishedFunnelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const published = await getPublishedFunnelBySlug(slug);
  if (!published) notFound();

  const home = getHomePage(published.funnel);
  const html = renderFunnelHtml(published.funnel, {
    targetPageId: home?.id,
    fullDocument: false,
    publicSlug: slug,
  });


  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <PublicFunnelRuntime />
    </>
  );
}
