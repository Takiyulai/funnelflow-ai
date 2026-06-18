// lib/crm/tags.ts
// Service interne CRM — Tags : CRUD + assignation + résolution par nom
// (utilisée par l'auto-tag à la soumission de formulaire). Logique pure
// (supabase + userId), réutilisable par les routes API et un futur webhook n8n.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tag } from "./types";

const TAG_COLS = "id, user_id, name, color, created_at";

const DEFAULT_COLORS = [
  "#6D5DF6", "#10B981", "#FB6F4C", "#F4467E", "#0EA5E9",
  "#C7A436", "#8B5CF6", "#EF4444", "#14B8A6", "#F59E0B",
];

function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return DEFAULT_COLORS[h % DEFAULT_COLORS.length];
}

export async function listTags(sb: SupabaseClient, userId: string): Promise<Tag[]> {
  const { data, error } = await sb
    .from("crm_tags")
    .select(TAG_COLS)
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Tag[];
}

export async function createTag(
  sb: SupabaseClient,
  userId: string,
  name: string,
  color?: string,
): Promise<Tag> {
  const clean = name.trim();
  if (!clean) throw new Error("name_required");
  const { data, error } = await sb
    .from("crm_tags")
    .insert({ user_id: userId, name: clean, color: color || pickColor(clean) })
    .select(TAG_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as Tag;
}

export async function updateTag(
  sb: SupabaseClient,
  userId: string,
  id: string,
  patch: { name?: string; color?: string },
): Promise<Tag> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.color !== undefined) update.color = patch.color;
  const { data, error } = await sb
    .from("crm_tags")
    .update(update)
    .eq("user_id", userId)
    .eq("id", id)
    .select(TAG_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as Tag;
}

export async function deleteTag(
  sb: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  // crm_contact_tags est en ON DELETE CASCADE → les liens partent avec le tag.
  const { error } = await sb.from("crm_tags").delete().eq("user_id", userId).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Résout des noms de tags en ids, en créant ceux qui manquent (idempotent).
 * Utilisé par l'auto-tag à la soumission de formulaire.
 */
export async function getOrCreateTagsByName(
  sb: SupabaseClient,
  userId: string,
  names: string[],
): Promise<Tag[]> {
  const clean = Array.from(
    new Set(names.map((n) => n.trim()).filter((n) => n.length > 0)),
  );
  if (clean.length === 0) return [];

  const existing = await listTags(sb, userId);
  const byLower = new Map(existing.map((t) => [t.name.toLowerCase(), t]));

  const result: Tag[] = [];
  for (const name of clean) {
    const found = byLower.get(name.toLowerCase());
    if (found) {
      result.push(found);
    } else {
      try {
        result.push(await createTag(sb, userId, name));
      } catch {
        // course possible (création concurrente) → on relit
        const refreshed = await listTags(sb, userId);
        const t = refreshed.find((x) => x.name.toLowerCase() === name.toLowerCase());
        if (t) result.push(t);
      }
    }
  }
  return result;
}

/** Ajoute des tags à un (ou plusieurs) contact(s). Idempotent (upsert). */
export async function assignTagsToContacts(
  sb: SupabaseClient,
  userId: string,
  contactIds: string[],
  tagIds: string[],
): Promise<void> {
  if (contactIds.length === 0 || tagIds.length === 0) return;
  const rows = contactIds.flatMap((contact_id) =>
    tagIds.map((tag_id) => ({ contact_id, tag_id, user_id: userId })),
  );
  const { error } = await sb
    .from("crm_contact_tags")
    .upsert(rows, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

/** Retire des tags d'un (ou plusieurs) contact(s). */
export async function removeTagsFromContacts(
  sb: SupabaseClient,
  userId: string,
  contactIds: string[],
  tagIds: string[],
): Promise<void> {
  if (contactIds.length === 0 || tagIds.length === 0) return;
  const { error } = await sb
    .from("crm_contact_tags")
    .delete()
    .eq("user_id", userId)
    .in("contact_id", contactIds)
    .in("tag_id", tagIds);
  if (error) throw new Error(error.message);
}
