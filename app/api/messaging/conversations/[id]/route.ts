// app/api/messaging/conversations/[id]/route.ts
// 🆕 Fil d'une conversation (GET) et envoi d'une réponse (POST).
//
// L'ouverture du fil remet le compteur de non-lus à zéro : c'est le geste
// naturel, et ça évite un bouton « marquer comme lu » que personne ne clique.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendMessage, TelegramError } from "@/lib/messaging/telegram";

export const dynamic = "force-dynamic";

/** Charge la conversation en vérifiant qu'elle appartient bien à l'appelant. */
async function loadOwned(conversationId: string, userId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("messaging_conversations")
    .select("id, user_id, channel_id, external_chat_id, display_name, username, contact_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data || data.user_id !== userId) return null;
  return data;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const conversation = await loadOwned(id, user.id);
  if (!conversation) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const admin = getSupabaseAdmin();
  const { data: messages, error } = await admin
    .from("messaging_messages")
    .select("id, direction, body, status, error, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) {
    console.error("[messaging/conversation]", error.message);
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  }

  // Le fil est ouvert → il est lu.
  await admin
    .from("messaging_conversations")
    .update({ unread_count: 0 })
    .eq("id", id);

  return NextResponse.json(
    { ok: true, conversation, messages: messages ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "empty_message" }, { status: 400 });
  }

  const conversation = await loadOwned(id, user.id);
  if (!conversation) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const admin = getSupabaseAdmin();
  const { data: channel } = await admin
    .from("messaging_channels")
    .select("credentials, status")
    .eq("id", conversation.channel_id)
    .maybeSingle();

  const token = (channel?.credentials as { token?: string } | null)?.token;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "channel_disconnected", message: "Canal Telegram non connecté." },
      { status: 400 },
    );
  }

  try {
    const sent = await sendMessage(token, conversation.external_chat_id, text);

    await admin.from("messaging_messages").insert({
      user_id: user.id,
      conversation_id: id,
      direction: "out",
      body: text,
      external_message_id: sent.messageId,
      status: "sent",
    });

    const nowIso = new Date().toISOString();
    await admin
      .from("messaging_conversations")
      .update({
        last_message_at: nowIso,
        last_message_preview: text.slice(0, 140),
        unread_count: 0,
      })
      .eq("id", id);

    return NextResponse.json({ ok: true, sentAt: nowIso });
  } catch (e) {
    const message =
      e instanceof TelegramError ? e.message : e instanceof Error ? e.message : "Envoi échoué.";
    console.error("[messaging/send]", message);

    // On garde une trace de l'échec DANS le fil : l'utilisateur voit que son
    // message n'est pas parti, au lieu de croire qu'il a été délivré.
    await admin.from("messaging_messages").insert({
      user_id: user.id,
      conversation_id: id,
      direction: "out",
      body: text,
      status: "failed",
      error: message,
    });

    return NextResponse.json({ ok: false, error: "send_failed", message }, { status: 400 });
  }
}
