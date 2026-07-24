// lib/crm/customFields.ts
// 🆕 MODULE 3 — Registre des champs personnalisés (table lead_custom_field_defs).
// Logique pure : prend un client Supabase (session, RLS) + userId.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomFieldDef } from "./types";

const COLS = "id, user_id, field_key, label, created_at";

/** Normalise un libellé libre en clé de champ valide (a-z0-9_, commence par
 *  une lettre, 50 caractères max) — reflète la contrainte SQL côté base. */
export function slugifyFieldKey(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(
      new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g"),
      "",
    ) // retire les accents (diacritiques combinants, forme NFD après normalize("NFD"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
  // Doit commencer par une lettre (contrainte SQL) — préfixe sinon.
  return /^[a-z]/.test(slug) ? slug : `champ_${slug}`.slice(0, 50);
}

export async function listCustomFieldDefs(
  sb: SupabaseClient,
  userId: string,
): Promise<CustomFieldDef[]> {
  const { data, error } = await sb
    .from("lead_custom_field_defs")
    .select(COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CustomFieldDef[];
}

export async function createCustomFieldDef(
  sb: SupabaseClient,
  userId: string,
  label: string,
): Promise<CustomFieldDef> {
  const cleanLabel = label.trim();
  if (!cleanLabel) throw new Error("field_label_required");
  const fieldKey = slugifyFieldKey(cleanLabel);
  if (!fieldKey) throw new Error("field_key_invalid");

  const { data, error } = await sb
    .from("lead_custom_field_defs")
    .insert({ user_id: userId, field_key: fieldKey, label: cleanLabel })
    .select(COLS)
    .single();
  if (error) {
    // Contrainte unique (user_id, field_key) déjà prise.
    if (error.code === "23505") throw new Error("field_already_exists");
    throw new Error(error.message);
  }
  return data as CustomFieldDef;
}

export async function deleteCustomFieldDef(
  sb: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await sb
    .from("lead_custom_field_defs")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
