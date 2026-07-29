// components/ui/PageHeader.tsx
// 🆕 En-tête de page unifié (titre + sous-titre + actions optionnelles).
//
// POURQUOI CE COMPOSANT. Chaque page réécrivait son propre en-tête à la main.
// Les marges et les tailles ont dérivé, mais surtout un décalage visible est
// apparu : le titre s'alignait à gauche de <main> pendant que le contenu
// vivait dans un conteneur centré (`mx-auto max-w-2xl`). Résultat, sur les
// écrans concernés, le titre semblait « flotter » à côté de sa propre carte.
//
// RÈGLE À TENIR : le contenu d'une page s'aligne à GAUCHE, comme son en-tête.
// Aucun `mx-auto` sur un bloc de contenu d'écran applicatif — sinon le
// décalage réapparaît. Les modales et les pages publiques (landing, mentions
// légales) ne sont pas concernées : elles n'ont pas d'en-tête de ce type.

import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Boutons alignés à droite du titre (repassent sous le titre sur mobile). */
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-black text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export default PageHeader;
