// app/p/[slug]/[pageSlug]/page.tsx — pages secondaires du funnel
import { notFound } from "next/navigation";
import { getPublishedFunnelBySlug } from "@/lib/funnels/loadPublished";
import { renderFunnelHtml } from "@/lib/export/html";
import { getPageBySlug } from "@/lib/funnels/types";
import PublicFunnelRuntime from "@/components/funnel/PublicFunnelRuntime";

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

  const html = renderFunnelHtml(published.funnel, {
    targetPageId: page.id,
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
