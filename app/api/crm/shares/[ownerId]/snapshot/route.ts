import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_CONTACTS = 200;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ownerId: string }> },
) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { ownerId } = await params;
  const { data: share, error: shareError } = await sb
    .from("crm_data_shares")
    .select("id")
    .eq("owner_user_id", ownerId)
    .eq("grantee_user_id", user.id)
    .eq("permission", "read_only")
    .maybeSingle();

  if (shareError || !share) {
    if (shareError) console.error("[crm/shares] vérification d’accès impossible", shareError);
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const parsedLimit = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(MAX_CONTACTS, Math.max(1, Math.trunc(parsedLimit)))
    : MAX_CONTACTS;
  const admin = getSupabaseAdmin();

  // Projection volontairement stricte : aucun metadata, custom_fields, IP,
  // user-agent, contenu de tunnel/email, commande ou historique technique.
  const [ownerRes, contactsRes, listsRes, tagsRes] = await Promise.all([
    admin.from("users").select("id,email,full_name").eq("id", ownerId).maybeSingle(),
    admin
      .from("leads")
      .select(
        "id,email,name,first_name,last_name,phone,status,source,consent,created_at",
        { count: "exact" },
      )
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("crm_lists")
      .select("id,name,description,color,origin,created_at")
      .eq("user_id", ownerId)
      .order("name"),
    admin
      .from("crm_tags")
      .select("id,name,color")
      .eq("user_id", ownerId)
      .order("name"),
  ]);

  const firstError = ownerRes.error ?? contactsRes.error ?? listsRes.error ?? tagsRes.error;
  if (firstError || !ownerRes.data) {
    console.error("[crm/shares] chargement du CRM partagé impossible", firstError);
    return NextResponse.json(
      { ok: false, message: "Le CRM partagé est momentanément indisponible." },
      { status: 503 },
    );
  }

  const contacts = contactsRes.data ?? [];
  const contactIds = contacts.map((contact) => contact.id);
  const [listLinksRes, tagLinksRes] = contactIds.length
    ? await Promise.all([
        admin
          .from("crm_contact_lists")
          .select("contact_id,list_id")
          .eq("user_id", ownerId)
          .in("contact_id", contactIds),
        admin
          .from("crm_contact_tags")
          .select("contact_id,tag_id")
          .eq("user_id", ownerId)
          .in("contact_id", contactIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (listLinksRes.error || tagLinksRes.error) {
    console.error(
      "[crm/shares] chargement des rattachements impossible",
      listLinksRes.error ?? tagLinksRes.error,
    );
    return NextResponse.json(
      { ok: false, message: "Le CRM partagé est momentanément indisponible." },
      { status: 503 },
    );
  }

  const listsById = new Map((listsRes.data ?? []).map((list) => [list.id, list]));
  const tagsById = new Map((tagsRes.data ?? []).map((tag) => [tag.id, tag]));
  const listLinks = new Map<string, unknown[]>();
  const tagLinks = new Map<string, unknown[]>();

  for (const link of listLinksRes.data ?? []) {
    const list = listsById.get(link.list_id);
    if (list) listLinks.set(link.contact_id, [...(listLinks.get(link.contact_id) ?? []), list]);
  }
  for (const link of tagLinksRes.data ?? []) {
    const tag = tagsById.get(link.tag_id);
    if (tag) tagLinks.set(link.contact_id, [...(tagLinks.get(link.contact_id) ?? []), tag]);
  }

  return NextResponse.json({
    ok: true,
    snapshot: {
      owner: ownerRes.data,
      totalContacts: contactsRes.count ?? contacts.length,
      contacts: contacts.map((contact) => ({
        ...contact,
        lists: listLinks.get(contact.id) ?? [],
        tags: tagLinks.get(contact.id) ?? [],
      })),
      lists: listsRes.data ?? [],
      tags: tagsRes.data ?? [],
      limit,
    },
  });
}
