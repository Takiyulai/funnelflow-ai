// Types du système de "skins" de templates : rendu bespoke DATA-DRIVEN.
// Un skin fournit, par type de section, un composant React qui reproduit le
// design du template (visuel + animations du zip Claude Design) en étant
// alimenté par les données réelles de la section (copy généré, éditable).
// Tout type de section sans composant dédié retombe sur le rendu standard.

import type { ComponentType } from "react";
import type {
  Funnel,
  FunnelPage,
  FunnelSection,
  FunnelSectionType,
  PageRole,
} from "@/lib/funnels/types";

export type SkinSectionProps = {
  section: FunnelSection;
  funnel: Funnel;
  page?: FunnelPage;
  pageLinks: Map<string, string>;
  slugLinks: Map<string, string>;
  compact?: boolean;
  /** 🆕 Rôle de la page (thankyou/confirmation/delivery…) : permet aux skins
   *  de styler aussi les pages de succès (badge ✓, centrage). */
  pageRole?: PageRole;
  /** 🆕 true si la page est une page de succès (merci/confirmation/livraison). */
  isSuccess?: boolean;
};

export type TemplateSkin = {
  id: string;
  /** Composants par type de section. Absent → rendu standard (fallback). */
  sections: Partial<Record<FunnelSectionType, ComponentType<SkinSectionProps>>>;
};
