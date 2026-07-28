// app/api/messaging/invite-link/route.ts
// 🆕 Lien d'invitation Telegram PERSONNALISÉ pour un contact du CRM.
//
// C'est la réponse au problème du premier pas : un prospect déjà en base, dont
// on connaît l'email mais pas le chat Telegram, devient joignable dès qu'il
// clique sur CE lien depuis un email. Le jeton signé qu'il contient rattache
// automatiquement la conversation au bon contact.
//
// Usage prévu : bouton « Inviter sur Telegram » dans la fiche contact, et
// insertion du lien dans les emails de séquence.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { telegramInviteUrl } from "@/lib/messaging/telegramLink";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const contactId = new URL(req.url).searchParams.get("contactId");
  const admin = getSupabaseAdmin();

  const { data: channel } = await admin
    .from("messaging_channels")
    .select("username, status")
    .eq("user_id", user.id)
    .eq("provider", "telegram")
    .maybeSingle();

  if (!channel?.username) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_channel",
        message: "Connecte d'abord ton bot Telegram depuis la Messagerie.",
      },
      { status: 400 },
    );
  }

  // 🔒 Le contact demandé doit appartenir à l'appelant : sinon on fabriquerait
  // un lien de rattachement vers le contact d'un autre compte.
  if (contactId) {
    const { data: owned } = await admin
      .from("leads")
      .select("id")
      .eq("id", contactId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!owned) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      url: telegramInviteUrl(channel.username, contactId),
      personalized: Boolean(contactId),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
