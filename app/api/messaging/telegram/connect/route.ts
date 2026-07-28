// app/api/messaging/telegram/connect/route.ts
// 🆕 Connexion (POST) et déconnexion (DELETE) du bot Telegram d'un utilisateur.
//
// Le jeton n'est jamais renvoyé au navigateur, ni ici ni ailleurs : les routes
// sélectionnent toujours les colonnes explicitement, jamais `*`.

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getBotInfo,
  setWebhook,
  deleteWebhook,
  TelegramError,
} from "@/lib/messaging/telegram";

export const dynamic = "force-dynamic";

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    process.env.APP_URL?.replace(/\/+$/, "") ||
    ""
  );
}

export async function POST(req: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = (body.token ?? "").trim();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "missing_token", message: "Colle le jeton donné par @BotFather." },
      { status: 400 },
    );
  }

  const base = appUrl();
  if (!base) {
    // Sans URL publique, Telegram n'a aucune adresse où livrer les messages.
    // On le dit franchement plutôt que d'enregistrer un canal inutilisable.
    return NextResponse.json(
      {
        ok: false,
        error: "missing_app_url",
        message:
          "NEXT_PUBLIC_APP_URL n'est pas configurée côté serveur : Telegram n'aurait aucune adresse où livrer les messages.",
      },
      { status: 500 },
    );
  }

  const admin = getSupabaseAdmin();

  try {
    // 1) Le jeton est-il valide ? On récupère au passage l'identité du bot.
    const info = await getBotInfo(token);

    // 2) Secret partagé, vérifié à chaque appel entrant.
    const webhookSecret = randomBytes(24).toString("hex");

    // 3) Enregistrement AVANT le branchement du webhook : si Telegram commence
    //    à livrer des messages, la ligne doit déjà exister pour les recevoir.
    const { data: channel, error } = await admin
      .from("messaging_channels")
      .upsert(
        {
          user_id: user.id,
          provider: "telegram",
          external_id: String(info.id),
          display_name: info.firstName,
          username: info.username,
          credentials: { token },
          webhook_secret: webhookSecret,
          status: "active",
          last_error: null,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      )
      .select("id, username, display_name")
      .single();

    if (error) throw new Error(error.message);

    // 4) Branchement du webhook.
    await setWebhook(
      token,
      `${base}/api/messaging/telegram/webhook/${channel.id}`,
      webhookSecret,
    );

    return NextResponse.json({
      ok: true,
      channel: {
        id: channel.id,
        username: channel.username,
        displayName: channel.display_name,
      },
    });
  } catch (e) {
    const message =
      e instanceof TelegramError ? e.message : e instanceof Error ? e.message : "Échec de la connexion.";
    console.error("[telegram/connect]", message);

    // Le canal a pu être enregistré avant l'échec du webhook : on le marque en
    // erreur pour que l'interface propose de réessayer, plutôt que d'afficher
    // un canal « actif » qui ne reçoit rien.
    await admin
      .from("messaging_channels")
      .update({ status: "error", last_error: message })
      .eq("user_id", user.id)
      .eq("provider", "telegram");

    return NextResponse.json({ ok: false, error: "connect_failed", message }, { status: 400 });
  }
}

export async function DELETE() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: channel } = await admin
    .from("messaging_channels")
    .select("id, credentials")
    .eq("user_id", user.id)
    .eq("provider", "telegram")
    .maybeSingle();

  if (channel) {
    const token = (channel.credentials as { token?: string } | null)?.token;
    // Best-effort : si Telegram refuse, on déconnecte quand même côté
    // AutoFunnel — l'utilisateur ne doit pas rester bloqué avec un canal
    // qu'il ne peut plus retirer.
    if (token) await deleteWebhook(token).catch(() => {});
    await admin.from("messaging_channels").delete().eq("id", channel.id);
  }

  return NextResponse.json({ ok: true });
}
