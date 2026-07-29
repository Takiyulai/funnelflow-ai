// lib/crm/contacts.ts
// Service interne CRM — Contacts (= table `leads` étendue).
// Logique pure : prend un client Supabase + userId. Réutilisable par les routes
// API (session utilisateur) ET par un futur webhook n8n (client admin + userId).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contact, ContactList, ContactWithTags, Tag, LeadStatus } from "./types";
import { normalizePhoneE164 } from "./phone";

const CONTACT_COLS =
  "id, user_id, funnel_id, email, name, first_name, last_name, phone, phone_country, status, source, consent, language, metadata, custom_fields, created_at";

/** Nettoie un terme de recherche pour l'opérateur PostgREST `or(...ilike...)`. */
function safeSearch(term: string): string {
  return term.replace(/[%,()*]/g, "").trim();
}

export type ListContactsOptions = {
  search?: string;
  tagId?: string;
  /** 🆕 Filtre par liste de contacts (provenance d'un lot importé). */
  listId?: string;
  status?: LeadStatus;
  funnelId?: string;
  limit?: number;
  offset?: number;
};

export type ContactInput = {
  email: string;
  name?: string | null;
  /** 🆕 MODULE 3 */
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  phone_country?: string | null;
  status?: LeadStatus;
  source?: string | null;
  funnel_id?: string | null;
  consent?: boolean;
  metadata?: Record<string, unknown>;
  /** 🆕 MODULE 3 — Champs libres (voir CustomFieldDef). */
  custom_fields?: Record<string, unknown>;
};

async function fetchTagsForContacts(
  sb: SupabaseClient,
  userId: string,
  ids: string[],
): Promise<Record<string, Tag[]>> {
  if (ids.length === 0) return {};
  const { data } = await sb
    .from("crm_contact_tags")
    .select("contact_id, crm_tags(id, user_id, name, color, created_at)")
    .eq("user_id", userId)
    .in("contact_id", ids);

  const map: Record<string, Tag[]> = {};
  const rows = (data ?? []) as {
    contact_id: string;
    crm_tags: Tag | Tag[] | null;
  }[];
  for (const row of rows) {
    const tag = Array.isArray(row.crm_tags) ? row.crm_tags[0] : row.crm_tags;
    if (!tag) continue;
    (map[row.contact_id] ??= []).push(tag);
  }
  return map;
}

/** 🆕 Symétrique de `fetchTagsForContacts`, pour les listes de contacts. */
async function fetchListsForContacts(
  sb: SupabaseClient,
  userId: string,
  ids: string[],
): Promise<Record<string, ContactList[]>> {
  if (ids.length === 0) return {};
  const { data } = await sb
    .from("crm_contact_lists")
    .select(
      "contact_id, crm_lists(id, user_id, name, description, origin, source_label, color, imported_at, created_at)",
    )
    .eq("user_id", userId)
    .in("contact_id", ids);

  const map: Record<string, ContactList[]> = {};
  const rows = (data ?? []) as {
    contact_id: string;
    crm_lists: ContactList | ContactList[] | null;
  }[];
  for (const row of rows) {
    const list = Array.isArray(row.crm_lists) ? row.crm_lists[0] : row.crm_lists;
    if (!list) continue;
    (map[row.contact_id] ??= []).push(list);
  }
  return map;
}

export async function listContacts(
  sb: SupabaseClient,
  userId: string,
  opts: ListContactsOptions = {},
): Promise<{ contacts: ContactWithTags[]; total: number }> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  // Filtre par tag : on récupère d'abord les contact_id concernés.
  let idFilter: string[] | null = null;
  if (opts.tagId) {
    const { data: links } = await sb
      .from("crm_contact_tags")
      .select("contact_id")
      .eq("user_id", userId)
      .eq("tag_id", opts.tagId);
    idFilter = (links ?? []).map((l: { contact_id: string }) => l.contact_id);
    if (idFilter.length === 0) return { contacts: [], total: 0 };
  }

  // 🆕 Filtre par liste : même principe. Combiné au filtre par tag, on prend
  // l'INTERSECTION (le contact doit satisfaire les deux), ce qui est le
  // comportement attendu quand on empile deux filtres dans une barre.
  if (opts.listId) {
    const { data: links } = await sb
      .from("crm_contact_lists")
      .select("contact_id")
      .eq("user_id", userId)
      .eq("list_id", opts.listId);
    const listIds = (links ?? []).map((l: { contact_id: string }) => l.contact_id);
    if (listIds.length === 0) return { contacts: [], total: 0 };
    idFilter = idFilter ? idFilter.filter((id) => listIds.includes(id)) : listIds;
    if (idFilter.length === 0) return { contacts: [], total: 0 };
  }

  let q = sb
    .from("leads")
    .select(CONTACT_COLS, { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status) q = q.eq("status", opts.status);
  if (opts.funnelId) q = q.eq("funnel_id", opts.funnelId);
  if (opts.search) {
    const s = safeSearch(opts.search);
    if (s) q = q.or(`email.ilike.%${s}%,name.ilike.%${s}%,phone.ilike.%${s}%`);
  }
  if (idFilter) q = q.in("id", idFilter);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);

  const contacts = (data ?? []) as Contact[];
  const ids = contacts.map((c) => c.id);
  const [tagsByContact, listsByContact] = await Promise.all([
    fetchTagsForContacts(sb, userId, ids),
    fetchListsForContacts(sb, userId, ids),
  ]);

  return {
    contacts: contacts.map((c) => ({
      ...c,
      tags: tagsByContact[c.id] ?? [],
      lists: listsByContact[c.id] ?? [],
    })),
    total: count ?? 0,
  };
}

export async function getContact(
  sb: SupabaseClient,
  userId: string,
  id: string,
): Promise<ContactWithTags | null> {
  const { data, error } = await sb
    .from("leads")
    .select(CONTACT_COLS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const [tagsByContact, listsByContact] = await Promise.all([
    fetchTagsForContacts(sb, userId, [id]),
    fetchListsForContacts(sb, userId, [id]),
  ]);
  return {
    ...(data as Contact),
    tags: tagsByContact[id] ?? [],
    lists: listsByContact[id] ?? [],
  };
}

export async function createContact(
  sb: SupabaseClient,
  userId: string,
  input: ContactInput,
): Promise<Contact> {
  const phone = normalizePhoneE164(input.phone, input.phone_country);
  const { data, error } = await sb
    .from("leads")
    .insert({
      user_id: userId,
      email: input.email.toLowerCase().trim(),
      name: input.name?.trim() || null,
      first_name: input.first_name?.trim() || null,
      last_name: input.last_name?.trim() || null,
      phone,
      phone_country: input.phone_country || null,
      status: input.status || "nouveau",
      source: input.source || "manual",
      funnel_id: input.funnel_id || null,
      consent: input.consent ?? false,
      metadata: input.metadata ?? {},
      custom_fields: input.custom_fields ?? {},
    })
    .select(CONTACT_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as Contact;
}

export async function updateContact(
  sb: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<ContactInput>,
): Promise<Contact> {
  const update: Record<string, unknown> = {};
  if (patch.email !== undefined) update.email = patch.email.toLowerCase().trim();
  if (patch.name !== undefined) update.name = patch.name?.trim() || null;
  if (patch.first_name !== undefined) update.first_name = patch.first_name?.trim() || null;
  if (patch.last_name !== undefined) update.last_name = patch.last_name?.trim() || null;
  if (patch.custom_fields !== undefined) update.custom_fields = patch.custom_fields;
  if (patch.phone !== undefined || patch.phone_country !== undefined) {
    update.phone = normalizePhoneE164(patch.phone ?? null, patch.phone_country ?? null);
    if (patch.phone_country !== undefined) {
      update.phone_country = patch.phone_country || null;
    }
  }
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.source !== undefined) update.source = patch.source || null;
  if (patch.funnel_id !== undefined) update.funnel_id = patch.funnel_id || null;
  if (patch.consent !== undefined) update.consent = patch.consent;
  if (patch.metadata !== undefined) update.metadata = patch.metadata;

  const { data, error } = await sb
    .from("leads")
    .update(update)
    .eq("user_id", userId)
    .eq("id", id)
    .select(CONTACT_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as Contact;
}

export async function deleteContact(
  sb: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await sb
    .from("leads")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
