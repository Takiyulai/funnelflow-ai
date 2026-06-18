// lib/crm/types.ts
// CRM (étape 1 : modèle de données). Types partagés entre services internes
// (lib/crm/*) et routes API (app/api/crm/*). Alignés sur db/crm-schema.sql.

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

export type CampaignStatus = "draft" | "sending" | "sent" | "failed";

export type Campaign = {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  /** Contenu HTML (rich text). */
  content: string;
  status: CampaignStatus;
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
