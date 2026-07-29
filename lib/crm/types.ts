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
  /** 🆕 MODULE 3 — Prénom/nom optionnels, en complément de `name` (nom complet
   *  historique, conservé pour compatibilité ascendante — jamais retiré). */
  first_name?: string | null;
  last_name?: string | null;
  /** Téléphone normalisé E.164, ex. "+33612345678". */
  phone: string | null;
  /** Pays ISO 3166-1 alpha-2, ex. "FR". */
  phone_country: string | null;
  status: LeadStatus;
  source: string | null;
  consent: boolean;
  language: string | null;
  metadata: Record<string, unknown>;
  /** 🆕 MODULE 3 — Champs libres définis par l'utilisateur (voir CustomFieldDef),
   *  disponibles dans le moteur de templating {{...}}. */
  custom_fields?: Record<string, unknown>;
  created_at: string;
};

/** 🆕 MODULE 3 — Définition d'un champ personnalisé (table lead_custom_field_defs). */
export type CustomFieldDef = {
  id: string;
  user_id: string;
  field_key: string;
  label: string;
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

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 LISTES DE CONTACTS (db/crm-lists.sql)
//
// À ne pas confondre avec un Tag : le tag qualifie le contact (« chaud »,
// « a demandé un devis »), la liste dit D'OÙ IL VIENT (quel import, quel
// salon, quelle campagne). C'est ce qui permet de retrouver ensemble un lot
// de contacts importés sans tunnel associé, au lieu de les voir se noyer
// parmi les leads capturés par les tunnels.
// ─────────────────────────────────────────────────────────────────────────────

/** Provenance d'une liste : fichier importé, ou création manuelle. */
export type ContactListOrigin = "import" | "manuel";

export type ContactList = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  origin: ContactListOrigin;
  /** Libellé libre de provenance, recopié dans `leads.source`. */
  source_label: string | null;
  color: string;
  /** Date du dernier import ayant alimenté la liste (null si manuelle). */
  imported_at: string | null;
  created_at: string;
};

/** Liste enrichie de son nombre de contacts (affichage des compteurs). */
export type ContactListWithCount = ContactList & { contactsCount: number };

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

/** Contact enrichi de ses tags (pour l'affichage liste/fiche).
 *  🆕 `lists` est OPTIONNEL : tout le code écrit avant les listes continue de
 *  construire des `ContactWithTags` sans ce champ (compatibilité ascendante). */
export type ContactWithTags = Contact & { tags: Tag[]; lists?: ContactList[] };

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 ÉTAPE 4 — Génération de séquences email par IA (génération seule, en
// mémoire ; pas encore de persistance — c'est l'étape suivante).
// ─────────────────────────────────────────────────────────────────────────────

/** Type/rôle d'un mail de séquence (oriente la structure et le ton générés par l'IA). */
export type SequenceType =
  | "bienvenue"
  | "nurturing"
  | "relance"
  | "offre"
  | "temoignage"
  | "lancement"
  | "reengagement"
  | "autre";

/**
 * 🆕 LOT 1 — Un « rôle » ajouté par l'utilisateur dans le constructeur de
 * séquence : chaque rôle ajouté = un mail généré. L'ORDRE de la liste = l'ordre
 * des mails. `label` est le libellé affiché ; obligatoire quand `id === "autre"`
 * (type personnalisé en saisie libre), sinon dérivé de `id`.
 */
export type SequenceRole = {
  id: SequenceType;
  label?: string;
};

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
  /** 🆕 LOT 4 — Date/heure ISO du webinaire (tunnels de type "webinar"). */
  webinarDate?: string | null;
  /** 🆕 LOT 4 — Lien externe du webinaire (Zoom/YouTube/Meet). */
  webinarExternalLink?: string | null;
  /** 🆕 LOT 5 — Mode du webinaire : "evergreen" → les emails générés doivent
   *  parler de manière RELATIVE à l'inscription du destinataire (jamais de
   *  date fixe). Absent/"live" → comportement inchangé (date fixe). */
  webinarMode?: "live" | "evergreen" | null;
  /** 🆕 LOT 9 — Nombre de jours du challenge (tunnels de type "challenge").
   *  Permet à l'onglet Emails de générer une séquence quotidienne (1 email
   *  par jour, Jour 1 à Jour N) au lieu d'une séquence générique. */
  challengeTotalDays?: number | null;
  /** 🆕 Webinaire — offre VENDUE APRÈS le webinaire, distincte de offerName/
   *  price/promise (qui désignent le webinaire lui-même pour ce kind). Permet
   *  à l'onglet Emails de générer l'email de vente post-webinaire avec le bon
   *  produit/prix/promesse au lieu de réutiliser ceux du webinaire. */
  postWebinarOfferName?: string | null;
  postWebinarPrice?: string | null;
  postWebinarPromise?: string | null;
};

/**
 * Entrée requise pour générer une séquence.
 * 🆕 LOT 1 : remplace `type` + `emailCount` par `roles` (liste ORDONNÉE de
 * rôles) — un mail est généré PAR rôle, dans l'ordre, le nombre de mails est
 * donc déduit de `roles.length` (plus de champ "nombre de mails" séparé).
 */
export type SequenceGenerationInput = {
  roles: SequenceRole[];
  /** Contexte libre saisi par l'utilisateur (offre, cible, ton, etc.). */
  context: string;
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
  /** Rétrocompat : rôle du 1er mail (ou "autre" si mixte). Préférer `roles`. */
  type: SequenceType;
  /** 🆕 LOT 1 : liste ordonnée des rôles (1 par mail). Absent sur les
   *  séquences créées avant le Lot 1 → on retombe alors sur `[{ id: type }]`. */
  roles?: SequenceRole[] | null;
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
  /** 🆕 Heures supplémentaires (0-23), cumulées avec delay_days — harmonise
   *  avec la granularité jours/heures/minutes des "Attendre" de workflow. */
  delay_hours: number;
  /** 🆕 Si défini (ISO), date/heure ABSOLUE d'envoi — prioritaire sur
   *  delay_days/delay_hours. NULL/absent = délai relatif à l'inscription. */
  send_at?: string | null;
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
  /** 🆕 LOT 1 : liste ordonnée des rôles (1 par mail). */
  roles?: SequenceRole[] | null;
  context?: string | null;
  language: Language;
  funnel_id?: string | null;
  status?: SequenceStatus;
  emails: Array<{
    position: number;
    delay_days: number;
    /** 🆕 Optionnel pour compat ascendante — défaut 0 côté service. */
    delay_hours?: number;
    /** 🆕 Date/heure absolue d'envoi (ISO) ou null pour le mode relatif. */
    send_at?: string | null;
    subject: string;
    content: string;
  }>;
};
