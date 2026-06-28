// lib/crm/types.ts
// CRM (étape 1 : modèle de données). Types partagés entre services internes
// (lib/crm/*) et routes API (app/api/crm/*). Alignés sur db/crm-schema.sql.

import type { Language } from "@/lib/funnels/types";

/** Statut d'un contact (réutilise les statuts existants des leads). */
export type LeadStatus = "nouveau" | "contacte" | "qualifie" | "client" | "perdu";

/** Contact = ligne de la table `leads` (étendue avec phone_country). */
export type Contact = {
  id: string;
  user_id: string;
  funnel_id: string | null;
  email: string;
  name: string | null;
  /** Téléphone normalisé E.164, ex. "+33612345678". */
  phone: string | null;
  /** Pays ISO 3166-1 alpha-2, ex. "FR". */
  phone_country: string | null;
  status: LeadStatus;
  source: string | null;
  consent: boolean;
  language: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

export type ContactTag = {
  contact_id: string;
  tag_id: string;
  user_id: string;
  created_at: string;
};

/** any = au moins un tag (OU), all = tous les tags (ET). */
export type SegmentMatch = "any" | "all";

/** Définition d'un filtre dynamique de segment. */
export type SegmentFilter = {
  tagIds?: string[];
  match?: SegmentMatch;
  status?: LeadStatus[];
  funnelId?: string | null;
  search?: string;
};

export type Segment = {
  id: string;
  user_id: string;
  name: string;
  filter: SegmentFilter;
  created_at: string;
  updated_at: string;
};

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

export type Campaign = {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  /** Contenu HTML (rich text). */
  content: string;
  status: CampaignStatus;
  /** 🆕 Date d'envoi programmée (ISO) si status = "scheduled". */
  scheduled_at: string | null;
  /** Destinataires via segment dynamique… */
  segment_id: string | null;
  /** …ou sélection manuelle de contact ids (prioritaire si défini). */
  recipient_ids: string[] | null;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailSendStatus = "pending" | "sent" | "failed";

export type EmailSend = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  user_id: string;
  email: string;
  status: EmailSendStatus;
  resend_id: string | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
};

/** Contact enrichi de ses tags (pour l'affichage liste/fiche). */
export type ContactWithTags = Contact & { tags: Tag[] };

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 ÉTAPE 4 — Génération de séquences email par IA (génération seule, en
// mémoire ; pas encore de persistance — c'est l'étape suivante).
// ─────────────────────────────────────────────────────────────────────────────

/** Type de séquence (oriente la structure et le ton générés par l'IA). */
export type SequenceType =
  | "bienvenue"
  | "nurturing"
  | "relance"
  | "lancement"
  | "reengagement"
  | "autre";

/** Un email d'une séquence générée (éditable côté UI). */
export type SequenceEmailDraft = {
  /** Ordre dans la séquence (0-based). */
  position: number;
  /** Délai d'envoi en jours depuis l'entrée dans la séquence (J+N). */
  delayDays: number;
  subject: string;
  /** Corps en texte simple / HTML léger. */
  body: string;
};

/**
 * Contexte d'un tunnel PUBLIÉ, résumé pour être injecté dans le prompt IA.
 * Source : table `funnels` (colonnes `brief` + `published_content`).
 */
export type TunnelContext = {
  funnelId: string;
  name: string;
  offerName: string;
  promise: string;
  mainPain: string;
  targetAudience: string;
  tone: string;
  language: Language;
  price: string;
  benefits: string[];
  bonuses: string[];
  guarantee: string | null;
  heroHeadline: string | null;
  heroSubheadline: string | null;
  /** URL publique du tunnel (si publié), sinon null. */
  url: string | null;
};

/** Entrée requise pour générer une séquence. */
export type SequenceGenerationInput = {
  type: SequenceType;
  /** Contexte libre saisi par l'utilisateur (offre, cible, ton, etc.). */
  context: string;
  /** Nombre d'emails souhaité (borné 1..10). */
  emailCount: number;
  language: Language;
  /** Contexte du tunnel rattaché (null si saisie manuelle sans tunnel). */
  tunnel: TunnelContext | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 ÉTAPE 5 — Persistance des séquences (tables crm_sequences / crm_sequence_emails).
// ─────────────────────────────────────────────────────────────────────────────

export type SequenceStatus = "draft" | "active" | "archived";

/** En-tête d'une séquence (table crm_sequences). */
export type Sequence = {
  id: string;
  user_id: string;
  name: string;
  type: SequenceType;
  context: string | null;
  language: Language;
  funnel_id: string | null;
  status: SequenceStatus;
  created_at: string;
  updated_at: string;
};

/** Email persistant d'une séquence (table crm_sequence_emails). */
export type SequenceEmail = {
  id: string;
  sequence_id: string;
  user_id: string;
  position: number;
  delay_days: number;
  subject: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type SequenceWithEmails = Sequence & { emails: SequenceEmail[] };

/** Payload pour créer/mettre à jour une séquence (en-tête + emails). */
export type SequenceInput = {
  name: string;
  type: SequenceType;
  context?: string | null;
  language: Language;
  funnel_id?: string | null;
  status?: SequenceStatus;
  emails: Array<{
    position: number;
    delay_days: number;
    subject: string;
    content: string;
  }>;
};
