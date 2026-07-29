// lib/crm/lists.ts
// 🆕 Service interne CRM — Listes de contacts.
//
// Une liste répond à une question que les tags ne savaient pas traiter :
// « d'où vient ce paquet de contacts ? ». Elle porte donc une origine
// (import / manuel), un libellé de provenance et une date d'import, là où un
// tag ne porte qu'un nom.
//
// Logique pure (client Supabase + userId), comme lib/crm/tags.ts : réutilisable
// depuis les routes API (client de session, RLS active) comme depuis un futur
// webhook (client admin + userId explicite).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContactList, ContactListOrigin, ContactListWithCount } from "./types";

const LIST_COLS =
  "id, user_id, name, description, origin, source_label, color, imported_at, created_at";

// Même palette que les tags, pour que listes et tags se ressemblent visuellement
// sans jamais tomber sur la même couleur par hasard côté interface.
const DEFAULT_COLORS = [
  "#6D5DF6", "#10B981", "#FB6F4C", "#F4467E", "#0EA5E9",
  "#C7A436", "#8B5CF6", "#EF4444", "#14B8A6", "#F59E0B",
];

function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return DEFAULT_COLORS[h % DEFAULT_COLORS.length];
}

/**
 * Liste les listes de l'utilisateur AVEC leur nombre de contacts.
 *
 * Le comptage se fait en une seule requête sur la table de liaison, puis en
 * mémoire : `count` par groupe n'existe pas dans PostgREST sans vue dédiée, et
 * une requête `head:true` par liste ferait N allers-retours. Le volume attendu
 * (quelques dizaines de listes, quelques milliers de liens) tient largement.
 */
export async function listContactLists(
  sb: SupabaseClient,
  userId: string,
): Promise<ContactListWithCount[]> {
  const { data, error } = await sb
    .from("crm_lists")
    .select(LIST_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const lists = (data ?? []) as ContactList[];
  if (lists.length === 0) return [];

  const { data: links } = await sb
    .from("crm_contact_lists")
    .select("list_id")
    .eq("user_id", userId);

  const counts = new Map<string, number>();
  for (const l of (links ?? []) as { list_id: string }[]) {
    counts.set(l.list_id, (counts.get(l.list_id) ?? 0) + 1);
  }

  return lists.map((l) => ({ ...l, contactsCount: counts.get(l.id) ?? 0 }));
}

export async function createContactList(
  sb: SupabaseClient,
  userId: string,
  input: {
    name: string;
    description?: string | null;
    origin?: ContactListOrigin;
    sourceLabel?: string | null;
    color?: string;
    importedAt?: string | null;
  },
): Promise<ContactList> {
  const name = input.name.trim();
  if (!name) throw new Error("name_required");

  const { data, error } = await sb
    .from("crm_lists")
    .insert({
      user_id: userId,
      name,
      description: input.description?.trim() || null,
      origin: input.origin ?? "manuel",
      source_label: input.sourceLabel?.trim() || null,
      color: input.color || pickColor(name),
      imported_at: input.importedAt ?? null,
    })
    .select(LIST_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as ContactList;
}

export async function updateContactList(
  sb: SupabaseClient,
  userId: string,
  id: string,
  patch: { name?: string; description?: string | null; color?: string },
): Promise<ContactList> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.description !== undefined) update.description = patch.description?.trim() || null;
  if (patch.color !== undefined) update.color = patch.color;

  const { data, error } = await sb
    .from("crm_lists")
    .update(update)
    .eq("user_id", userId)
    .eq("id", id)
    .select(LIST_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as ContactList;
}

/**
 * Supprime une liste.
 *
 * ⚠️ Ne supprime QUE la liste et ses liens (ON DELETE CASCADE sur
 * crm_contact_lists) : les contacts eux-mêmes sont conservés. C'est
 * volontaire — perdre une liste ne doit jamais faire perdre des contacts.
 */
export async function deleteContactList(
  sb: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await sb.from("crm_lists").delete().eq("user_id", userId).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Retourne la liste nommée `name`, en la créant si elle n'existe pas.
 * Utilisé par l'import CSV : l'utilisateur saisit un nom de lot, on ne veut ni
 * doublon ni échec si le nom existe déjà (deux imports dans le même lot).
 */
export async function getOrCreateContactList(
  sb: SupabaseClient,
  userId: string,
  name: string,
  extra: { origin?: ContactListOrigin; sourceLabel?: string | null } = {},
): Promise<ContactList> {
  const clean = name.trim();
  if (!clean) throw new Error("name_required");

  // ⚠️ Comparaison faite EN MÉMOIRE et non via `.ilike(...)` : dans un motif
  // ilike, `%` et `_` sont des jokers. Une liste nommée « -50% clients »
  // matcherait alors n'importe quoi et on rattacherait l'import à la mauvaise
  // liste. Le volume (quelques dizaines de listes) rend ce filtrage local
  // parfaitement acceptable.
  const { data: all } = await sb
    .from("crm_lists")
    .select(LIST_COLS)
    .eq("user_id", userId);

  const existing = ((all ?? []) as ContactList[]).find(
    (l) => l.name.trim().toLowerCase() === clean.toLowerCase(),
  );

  if (existing) {
    // Réimport dans une liste existante : on rafraîchit la date d'import pour
    // que l'affichage reste parlant (« alimentée le … »).
    if (extra.origin === "import") {
      await sb
        .from("crm_lists")
        .update({ imported_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("id", existing.id);
    }
    return existing;
  }

  try {
    return await createContactList(sb, userId, {
      name: clean,
      origin: extra.origin ?? "manuel",
      sourceLabel: extra.sourceLabel ?? null,
      importedAt: extra.origin === "import" ? new Date().toISOString() : null,
    });
  } catch {
    // Création concurrente (index unique sur lower(name)) : on relit.
    const { data: retry } = await sb
      .from("crm_lists")
      .select(LIST_COLS)
      .eq("user_id", userId);
    const found = ((retry ?? []) as ContactList[]).find(
      (l) => l.name.trim().toLowerCase() === clean.toLowerCase(),
    );
    if (found) return found;
    throw new Error("list_create_failed");
  }
}

/** Ajoute des contacts à des listes. Idempotent (upsert sur la clé primaire). */
export async function addContactsToLists(
  sb: SupabaseClient,
  userId: string,
  contactIds: string[],
  listIds: string[],
): Promise<void> {
  if (contactIds.length === 0 || listIds.length === 0) return;
  const rows = contactIds.flatMap((contact_id) =>
    listIds.map((list_id) => ({ contact_id, list_id, user_id: userId })),
  );
  const { error } = await sb
    .from("crm_contact_lists")
    .upsert(rows, { onConflict: "contact_id,list_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

/** Retire des contacts de listes (les contacts eux-mêmes sont conservés). */
export async function removeContactsFromLists(
  sb: SupabaseClient,
  userId: string,
  contactIds: string[],
  listIds: string[],
): Promise<void> {
  if (contactIds.length === 0 || listIds.length === 0) return;
  const { error } = await sb
    .from("crm_contact_lists")
    .delete()
    .eq("user_id", userId)
    .in("contact_id", contactIds)
    .in("list_id", listIds);
  if (error) throw new Error(error.message);
}

/** Ids des contacts appartenant à une liste (utilisé par le filtre CRM). */
export async function contactIdsInList(
  sb: SupabaseClient,
  userId: string,
  listId: string,
): Promise<string[]> {
  const { data } = await sb
    .from("crm_contact_lists")
    .select("contact_id")
    .eq("user_id", userId)
    .eq("list_id", listId);
  return (data ?? []).map((r: { contact_id: string }) => r.contact_id);
}
