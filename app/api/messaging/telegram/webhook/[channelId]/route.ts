// app/api/messaging/telegram/webhook/[channelId]/route.ts
// 🆕 Réception des messages Telegram.
//
// 🔒 SÉCURITÉ : l'URL contient l'id du canal, qui n'est pas un secret. Ce qui
// authentifie l'appel, c'est l'en-tête `X-Telegram-Bot-Api-Secret-Token`,
// comparé au secret tiré au hasard à la connexion. Sans cette vérification,
// n'importe qui connaissant l'URL pourrait injecter de faux messages dans la
// boîte de réception d'un utilisateur.
//
// ⚠️ TOUJOURS RÉPONDRE 200. Telegram réémet un update tant qu'il ne reçoit pas
// de succès, et finit par suspendre le webhook après trop d'échecs. Une erreur
// de notre côté ne doit donc jamais remonter en 500 : on journalise et on
// acquitte. L'idempotence est assurée par l'index unique sur
// (conversation_id, external_message_id).

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  displayNameFromUpdate,
  type TelegramUpdate,
} from "@/lib/messaging/telegram";
import { parseStartPayload } from "@/lib/messaging/telegramLink";

export const dynamic = "force-dynamic";

const ACK = NextResponse.json({ ok: true });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;

  try {
    const admin = getSupabaseAdmin();

    const { data: channel } = await admin
      .from("messaging_channels")
      .select("id, user_id, webhook_secret, status")
      .eq("id", channelId)
      .maybeSingle();

    if (!channel) return ACK; // canal supprimé : on acquitte sans rien faire

    const provided = req.headers.get("x-telegram-bot-api-secret-token");
    if (!provided || provided !== channel.webhook_secret) {
      console.warn(`[telegram/webhook] secret invalide pour le canal ${channelId}`);
      // 401 volontaire ici : ce n'est PAS Telegram qui appelle, donc aucun
      // risque de faire suspendre le webhook légitime.
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
    const message = update?.message;
    const chatId = message?.chat?.id;
    if (!update || !message || chatId === undefined || chatId === null) return ACK;

    // On ne traite que le texte en v1 (photos, vocaux, documents : plus tard).
    const text = (message.text ?? "").trim();
    if (!text) return ACK;

    const externalChatId = String(chatId);
    const name = displayNameFromUpdate(update);
    const username = message.from?.username ?? message.chat?.username ?? null;
    const nowIso = new Date().toISOString();
    const preview = text.slice(0, 140);

    // 🆕 RATTACHEMENT AU CRM via lien profond signé.
    //
    // C'est le SEUL moment où l'on peut relier un chat Telegram à un contact
    // connu : le prospect a cliqué sur un lien personnalisé
    // (t.me/bot?start=<jeton>), et Telegram nous transmet ce jeton avec la
    // commande /start. Passé cette occasion, aucune API ne permet de faire le
    // rapprochement — d'où l'importance de placer ces liens personnalisés dans
    // les emails et sur la page de remerciement.
    //
    // Un jeton invalide ou absent laisse simplement `contact_id` à null : la
    // conversation existe, mais n'est rattachée à personne. On ne devine JAMAIS.
    let linkedContactId: string | null = null;
    const startMatch = text.match(/^\/start(?:\s+(\S+))?$/);
    if (startMatch) {
      linkedContactId = parseStartPayload(startMatch[1]);
      if (linkedContactId) {
        // Le contact appartient-il bien au propriétaire du canal ? Sans ce
        // contrôle, un jeton forgé pour un contact d'un AUTRE utilisateur
        // rattacherait une conversation au mauvais compte.
        const { data: owned } = await admin
          .from("leads")
          .select("id")
          .eq("id", linkedContactId)
          .eq("user_id", channel.user_id)
          .maybeSingle();
        if (!owned) linkedContactId = null;
      }
    }

    // ── Conversation : créée au premier message, mise à jour ensuite ────────
    const { data: conversation, error: convErr } = await admin
      .from("messaging_conversations")
      .upsert(
        {
          user_id: channel.user_id,
          channel_id: channel.id,
          external_chat_id: externalChatId,
          display_name: name,
          username,
          last_message_at: nowIso,
          last_message_preview: preview,
          status: "open",
          // Renseigné uniquement quand le lien signé l'a identifié ; sinon on
          // laisse la colonne telle quelle (un rattachement déjà établi lors
          // d'un /start précédent ne doit pas être écrasé par un message
          // ultérieur sans jeton).
          ...(linkedContactId ? { contact_id: linkedContactId } : {}),
        },
        { onConflict: "channel_id,external_chat_id" },
      )
      .select("id, unread_count")
      .single();

    if (convErr || !conversation) {
      console.error("[telegram/webhook] upsert conversation :", convErr?.message);
      return ACK;
    }

    // ── Message ─────────────────────────────────────────────────────────────
    const externalMessageId =
      message.message_id !== undefined ? String(message.message_id) : null;

    const { error: msgErr } = await admin.from("messaging_messages").insert({
      user_id: channel.user_id,
      conversation_id: conversation.id,
      direction: "in",
      body: text,
      external_message_id: externalMessageId,
      status: "received",
    });

    // 23505 = message déjà enregistré (Telegram a réémis l'update). Ce n'est
    // pas une erreur : on acquitte sans incrémenter le compteur de non-lus.
    if (msgErr) {
      if (msgErr.code === "23505") return ACK;
      console.error("[telegram/webhook] insert message :", msgErr.message);
      return ACK;
    }

    await admin
      .from("messaging_conversations")
      .update({ unread_count: (conversation.unread_count ?? 0) + 1 })
      .eq("id", conversation.id);

    return ACK;
  } catch (e) {
    // Jamais de 500 : cf. l'en-tête de fichier.
    console.error("[telegram/webhook] erreur inattendue :", e);
    return ACK;
  }
}
