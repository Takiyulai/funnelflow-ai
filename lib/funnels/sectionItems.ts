// lib/funnels/sectionItems.ts
//
// Helpers pour les items spécialisés (FAQ, témoignages, pricing, bonus, garantie).
// Création d'items vides + migration auto des bullets existants vers le nouveau
// format (Livraison B, choix utilisateur "ii" — migration automatique).

import type {
  BonusItem,
  FaqItem,
  FunnelSection,
  FunnelSectionType,
  GuaranteeItem,
  PricingPlanItem,
  SectionItem,
  TestimonialItem,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Mapping section.type → kind d'item
// ─────────────────────────────────────────────────────────────────────────────

/** Retourne le kind d'item attendu pour un type de section, ou null si la
 *  section ne gère pas d'items spécialisés (hero, problem, solution, etc.). */
export function itemKindForSectionType(
  type: FunnelSectionType
): SectionItem["kind"] | null {
  switch (type) {
    case "faq":
      return "faq";
    case "proof":
      // Les sections "proof" sont en pratique des témoignages clients
      return "testimonial";
    case "pricing":
      return "pricing";
    case "bonus":
      return "bonus";
    case "guarantee":
      return "guarantee";
    default:
      return null;
  }
}

/** Retourne true si la section utilise des items spécialisés au lieu de bullets. */
export function sectionUsesItems(type: FunnelSectionType): boolean {
  return itemKindForSectionType(type) !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Création d'items par défaut (pour les boutons "+ Ajouter")
// ─────────────────────────────────────────────────────────────────────────────

export function makeEmptyFaqItem(): FaqItem {
  return { question: "", answer: "" };
}

export function makeEmptyTestimonialItem(): TestimonialItem {
  return {
    quote: "",
    authorName: "",
    authorRole: "",
    rating: 5,
  };
}

export function makeEmptyPricingItem(): PricingPlanItem {
  return {
    name: "",
    price: "",
    period: "",
    description: "",
    features: [],
    highlighted: false,
  };
}

export function makeEmptyBonusItem(): BonusItem {
  return { title: "", description: "", value: "", iconName: "gift" };
}

export function makeEmptyGuaranteeItem(): GuaranteeItem {
  return {
    title: "",
    description: "",
    iconName: "shield",
    duration: "",
  };
}

/** Crée un SectionItem vide selon le kind demandé. */
export function makeEmptyItem(kind: SectionItem["kind"]): SectionItem {
  switch (kind) {
    case "faq":
      return { kind: "faq", data: makeEmptyFaqItem() };
    case "testimonial":
      return { kind: "testimonial", data: makeEmptyTestimonialItem() };
    case "pricing":
      return { kind: "pricing", data: makeEmptyPricingItem() };
    case "bonus":
      return { kind: "bonus", data: makeEmptyBonusItem() };
    case "guarantee":
      return { kind: "guarantee", data: makeEmptyGuaranteeItem() };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration : bullets existants → items
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Heuristique : un bullet de FAQ généré par l'IA arrive souvent sous forme
 * "Question ? — Réponse" ou "Question ? : Réponse" ou simplement la question.
 * On essaie d'extraire la paire, sinon on met le bullet en question avec une
 * réponse vide à compléter par l'utilisateur.
 */
function bulletToFaqItem(bullet: string): FaqItem {
  const trimmed = bullet.trim();
  if (!trimmed) return { question: "", answer: "" };

  const separators = [" — ", " – ", " - ", " : ", " ? ", "?"];
  for (const sep of separators) {
    const idx = trimmed.indexOf(sep);
    if (idx > 0 && idx < trimmed.length - sep.length) {
      const question = trimmed.slice(0, idx).trim();
      let answer = trimmed.slice(idx + sep.length).trim();
      // Si on a coupé sur "?" on remet le point d'interrogation à la question
      if (sep === "?" || sep === " ? ") {
        return {
          question: question.endsWith("?") ? question : `${question} ?`,
          answer,
        };
      }
      return { question, answer };
    }
  }

  // Pas de séparateur trouvé : tout en question, réponse vide
  const question = trimmed.endsWith("?") ? trimmed : `${trimmed} ?`;
  return { question, answer: "" };
}

function bulletToTestimonialItem(bullet: string): TestimonialItem {
  // Heuristique : "« Citation » — Auteur" ou "Citation - Auteur"
  const trimmed = bullet.trim();
  const separators = [" — ", " – ", " - "];
  for (const sep of separators) {
    const idx = trimmed.lastIndexOf(sep);
    if (idx > 0 && idx < trimmed.length - sep.length) {
      const quote = trimmed.slice(0, idx).trim().replace(/^[«"]|[»"]$/g, "");
      const authorName = trimmed.slice(idx + sep.length).trim();
      return { quote, authorName, rating: 5 };
    }
  }
  return { quote: trimmed, authorName: "", rating: 5 };
}

function bulletToPricingItem(bullet: string): PricingPlanItem {
  // Heuristique : "Nom — Prix" ou simplement le nom
  const trimmed = bullet.trim();
  const separators = [" — ", " – ", " - ", " : "];
  for (const sep of separators) {
    const idx = trimmed.indexOf(sep);
    if (idx > 0 && idx < trimmed.length - sep.length) {
      return {
        name: trimmed.slice(0, idx).trim(),
        price: trimmed.slice(idx + sep.length).trim(),
        features: [],
      };
    }
  }
  return { name: trimmed, price: "", features: [] };
}

function bulletToBonusItem(bullet: string): BonusItem {
  return { title: bullet.trim(), iconName: "gift" };
}

function bulletToGuaranteeItem(bullet: string): GuaranteeItem {
  return { title: bullet.trim(), iconName: "shield" };
}

/**
 * Migre les bullets d'une section vers le nouveau format `items`.
 * Retourne null si la section n'a pas besoin de migration (pas du bon type ou
 * items déjà présents).
 */
export function migrateSectionBulletsToItems(
  section: FunnelSection
): SectionItem[] | null {
  const kind = itemKindForSectionType(section.type);
  if (!kind) return null;

  // Items déjà présents et non vides → on ne touche pas
  if (Array.isArray(section.items) && section.items.length > 0) return null;

  const bullets = Array.isArray(section.bullets) ? section.bullets : [];
  if (bullets.length === 0) return [];

  return bullets
    .filter((b) => typeof b === "string" && b.trim().length > 0)
    .map<SectionItem>((bullet) => {
      switch (kind) {
        case "faq":
          return { kind: "faq", data: bulletToFaqItem(bullet) };
        case "testimonial":
          return { kind: "testimonial", data: bulletToTestimonialItem(bullet) };
        case "pricing":
          return { kind: "pricing", data: bulletToPricingItem(bullet) };
        case "bonus":
          return { kind: "bonus", data: bulletToBonusItem(bullet) };
        case "guarantee":
          return { kind: "guarantee", data: bulletToGuaranteeItem(bullet) };
      }
    });
}

/**
 * Migre toutes les sections d'un tunnel.
 * À appeler une seule fois au chargement (par ex. dans funnelStore).
 * Idempotent : si une section a déjà des items, ne touche pas.
 */
export function migrateAllSections(sections: FunnelSection[]): FunnelSection[] {
  return sections.map((section) => {
    const migrated = migrateSectionBulletsToItems(section);
    if (migrated === null) return section;
    return { ...section, items: migrated };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture / mutation typée des items
// ─────────────────────────────────────────────────────────────────────────────

/** Filtre les items d'une section selon leur kind (typage exact garanti). */
export function getItemsOfKind<K extends SectionItem["kind"]>(
  items: SectionItem[] | undefined,
  kind: K
): Extract<SectionItem, { kind: K }>["data"][] {
  if (!Array.isArray(items)) return [];
  const filtered = items.filter((it) => it.kind === kind);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return filtered.map((it) => it.data) as any;
}


