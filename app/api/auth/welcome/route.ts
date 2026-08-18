// app/api/auth/welcome/route.ts
//
// 🆕 Envoi de l'email de bienvenue, au PREMIER chargement du tableau de bord.
//
// ── POURQUOI ICI, ET PAS AILLEURS ───────────────────────────────────────────
// L'inscription se fait en client pur : `supabase.auth.signUp` dans
// components/auth/AuthForm.tsx (~ligne 66). Elle ne traverse AUCUNE route
// serveur à nous — il n'existe donc pas de « après création du compte » côté
// serveur où se brancher.
//
// Les alternatives et pourquoi elles ont été écartées :
//   • Appeler Resend depuis AuthForm → exposerait la clé API au navigateur.
//   • Trigger PostgreSQL sur auth.users → un trigger ne fait pas d'appel HTTP
//     sortant sans pg_net/Edge Function, soit une pièce d'infra de plus à
//     maintenir pour un seul message.
//   • Webhook Supabase Auth → dépend d'une configuration hors dépôt, invisible
//     à la relecture du code et facile à perdre lors d'une migration de projet.
//
// Le premier chargement du dashboard est le point d'accroche déjà retenu pour
// `stamp-login` (voir app/api/auth/stamp-login/route.ts) : même schéma, même
// endroit d'appel, aucune nouvelle dépendance. Il couvre aussi l'inscription
// par Google, qui passe par /auth/callback et n'a pas non plus de hook.
//
// ⚠️ N'AFFECTE PAS le flux booking : ce fichier n'importe rien de
// lib/booking/*, et le module d'emails plateforme est séparé.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/platform/emails";

export const dynamic = "force-dynamic";

export async function POST() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    const { data: row, error: readError } = await admin
      .from("users")
      .select("welcome_email_sent_at, full_name, email")
      .eq("id", user.id)
      .maybeSingle<{
        welcome_email_sent_at: string | null;
        full_name: string | null;
        email: string | null;
      }>();

    // Colonne absente (migration 06 non appliquée) : on NE TENTE PAS d'envoyer.
    // Sans verrou possible, chaque chargement du dashboard renverrait un mail —
    // et le quota Resend est partagé avec les emails de rendez-vous.
    if (readError) {
      const missing =
        readError.code === "42703" ||
        /column .* does not exist/i.test(readError.message ?? "") ||
        /could not find the '.*' column/i.test(readError.message ?? "");
      if (missing) {
        console.warn(
          "[welcome-email] ⚠️ Colonne welcome_email_sent_at absente — migration 06 " +
            "non appliquée. Envoi désactivé pour éviter les doublons.",
        );
        return NextResponse.json({ ok: true, skipped: "migration_pending" });
      }
      throw new Error(readError.message);
    }

    // Déjà envoyé : le cas le plus fréquent, traité en premier et sans écriture.
    if (row?.welcome_email_sent_at) {
      return NextResponse.json({ ok: true, skipped: "already_sent" });
    }

    // Pas de profil applicatif. Le trigger `on_auth_user_created`
    // (supabase/schema.sql ~ligne 376) crée normalement cette ligne à
    // l'inscription ; son absence signale un compte antérieur au trigger, ou un
    // trigger non appliqué. Sans ligne, le verrou anti-doublon ci-dessous
    // n'aurait aucun support et l'envoi se répéterait à chaque chargement.
    // On sort en le DISANT — sinon le silence serait indiscernable d'un succès.
    if (!row) {
      console.warn(
        `[welcome-email] ⚠️ Aucune ligne public.users pour ${user.id} — ` +
          "email de bienvenue ignoré (pas de verrou anti-doublon possible).",
      );
      return NextResponse.json({ ok: true, skipped: "no_profile" });
    }

    // 🔒 VERROU AVANT ENVOI, pas après.
    //
    // React 18 en mode strict monte les effets DEUX FOIS, et un rechargement
    // pendant l'envoi rejouerait l'appel. Poser la date d'abord — de façon
    // conditionnelle — garantit qu'un seul appel passe : le second voit la
    // colonne déjà remplie et repart. Le prix de ce choix est qu'un échec
    // Resend ne sera pas retenté automatiquement ; c'est le compromis
    // volontaire, un doublon étant plus visible pour l'utilisateur qu'un
    // message manquant, et le quota étant partagé avec les rendez-vous.
    const nowIso = new Date().toISOString();
    const { data: locked, error: lockError } = await admin
      .from("users")
      .update({ welcome_email_sent_at: nowIso })
      .eq("id", user.id)
      .is("welcome_email_sent_at", null)
      .select("id");

    if (lockError) throw new Error(lockError.message);
    if (!locked || locked.length === 0) {
      // Un appel concurrent a pris le verrou entre notre lecture et notre
      // écriture. Il enverra le message ; nous, non.
      return NextResponse.json({ ok: true, skipped: "race_lost" });
    }

    const result = await sendWelcomeEmail({
      email: row?.email ?? user.email ?? "",
      name:
        row?.full_name ??
        (user.user_metadata?.name as string | undefined) ??
        null,
    });

    // Échec d'envoi → on RELÂCHE le verrou, pour qu'un prochain chargement
    // puisse réessayer. Sans cela, une coupure Resend priverait définitivement
    // l'utilisateur de son message de bienvenue.
    if (!result.ok) {
      await admin
        .from("users")
        .update({ welcome_email_sent_at: null })
        .eq("id", user.id);
      return NextResponse.json({ ok: false, error: result.reason }, { status: 200 });
    }

    return NextResponse.json({ ok: true, sent: true });
  } catch (e) {
    // Non bloquant : cette route est appelée au chargement du dashboard, une
    // erreur ici ne doit jamais empêcher l'utilisateur d'accéder à son compte.
    console.error("[welcome-email] ❌", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "welcome_failed" },
      { status: 200 },
    );
  }
}
