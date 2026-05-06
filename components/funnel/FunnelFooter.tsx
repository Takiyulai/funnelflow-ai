"use client";

import type { Funnel } from "@/lib/funnels/types";

type Props = {
  funnel: Funnel;
};

export default function FunnelFooter({ funnel }: Props) {
  // Extract business info from meta or brief (whichever stores it in your project)
  const meta = (funnel.meta ?? {}) as Record<string, any>;
  const brief = (funnel as any).brief ?? {};

  const businessName: string =
    meta.businessName || brief.businessName || meta.brand || brief.brand || "";
  const ownerName: string = meta.ownerName || brief.ownerName || "";
  const email: string = meta.contactEmail || brief.contactEmail || "";
  const phone: string = meta.contactPhone || brief.contactPhone || "";
  const address: string = meta.address || brief.address || "";
  const legalForm: string = meta.legalForm || brief.legalForm || "";
  const siret: string = meta.siret || brief.siret || "";

  // If nothing to show, render nothing (avoid empty footer)
  const hasAny =
    businessName || ownerName || email || phone || address || legalForm || siret;
  if (!hasAny) return null;

  const year = new Date().getFullYear();
  const displayName = businessName || ownerName;

  return (
    <footer className="ff-footer" role="contentinfo">
      {displayName && <div className="ff-footer-business">{displayName}</div>}

      <div className="ff-footer-meta">
        {legalForm && <span>{legalForm}</span>}
        {siret && <span>SIRET&nbsp;: {siret}</span>}
        {address && <span>{address}</span>}
        {email && <span>{email}</span>}
        {phone && <span>{phone}</span>}
      </div>

      <div className="ff-footer-copyright">
        © {year} {displayName || "Tous droits réservés"}.
      </div>
    </footer>
  );
}
