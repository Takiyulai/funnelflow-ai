import type { PublishedFunnel } from "@/lib/funnels/loadPublished";
import type { FunnelPage } from "@/lib/funnels/types";
import { resolvePublicCustomCode } from "@/lib/funnels/customCode";
import { CustomCodeBlock } from "@/components/funnel/CustomCodeBlock";
import { serveAbVariant } from "@/lib/ab/serve";
import PublishedFunnelView from "./PublishedFunnelView";

/** Shared by dynamic subpages and the reserved /merci route, after one lookup. */
export default async function PublishedSubPage({ published, page, slug, searchParams }: {
  published: PublishedFunnel;
  page: FunnelPage;
  slug: string;
  searchParams: Promise<{ ff_ab?: string }>;
}) {
  const sp = await searchParams;
  const forced = sp.ff_ab === "a" || sp.ff_ab === "b" ? sp.ff_ab : null;
  const customCode = await resolvePublicCustomCode(published.funnel, published.ownerId);
  const { page: activePage } = await serveAbVariant(
    published.funnelId, published.ownerId, page, forced,
  );
  return <>
    <CustomCodeBlock code={customCode?.head ?? null} zone="head" />
    <PublishedFunnelView funnel={published.funnel} funnelSlug={slug} activePage={activePage} />
    <CustomCodeBlock code={customCode?.body ?? null} zone="body" />
  </>;
}
