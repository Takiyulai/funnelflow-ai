// app/api/messaging/conversations/route.ts
// 🆕 Liste des conversations + état du canal connecté.
//
// Une seule requête alimente toute la boîte de réception : l'interface a besoin
// de savoir dans le même mouvement si un canal est branché et quelles
// conversations existent, pour afficher soit l'écran de connexion, soit la
// liste.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // ⚠️ Colonnes explicites : `credentials` (le jeton du bot) ne doit JAMAIS
  // sortir du serveur.
  const { data: channel } = await admin
    .from("messaging_channels")
    .select("id, provider, username, display_name, status, last_error, connected_at")
    .eq("user_id", user.id)
    .eq("provider", "telegram")
    .maybeSingle();

  if (!channel) {
    return NextResponse.json(
      { ok: true, channel: null, conversations: [], unreadTotal: 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: conversations, error } = await admin
    .from("messaging_conversations")
    .select(
      "id, external_chat_id, contact_id, display_name, username, last_message_at, last_message_preview, unread_count, status",
    )
    .eq("user_id", user.id)
    .eq("channel_id", channel.id)
    .eq("status", "open")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    console.error("[messaging/conversations]", error.message);
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  }

  const list = conversations ?? [];
  const unreadTotal = list.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  // 🆕 Lien d'invitation GÉNÉRIQUE (sans jeton) : à coller sur un tunnel ou en
  // bio. Les liens PERSONNALISÉS — ceux qui rattachent automatiquement la
  // conversation au bon contact CRM — sont produits par contact via
  // `telegramInviteUrl()`, dans les emails et la fiche contact.
  const inviteUrl = channel.username ? `https://t.me/${channel.username}` : null;

  return NextResponse.json(
    { ok: true, channel, conversations: list, unreadTotal, inviteUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
