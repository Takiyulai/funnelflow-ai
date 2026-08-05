// app/api/templates/share/route.ts
//
// Partager un tunnel dans la GALERIE COMMUNAUTAIRE.
//
// 🆕 OUVERT À TOUT COMPTE CONNECTÉ (plus de garde d'abonnement).
// Le partage ALIMENTE la galerie : le refuser aux non-abonnés appauvrissait le
// catalogue sans rien protéger — contribuer est un cadeau fait à la plateforme,
// pas une consommation de ressource. Seule la CONSOMMATION de la galerie
// (« Utiliser ce modèle ») reste soumise aux droits du plan.
//
// Le contenu reste désinfecté avant publication (cf. sanitizeFunnelForSharing).
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sanitizeFunnelForSharing } from "@/lib/templates/shareable";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Plafond du contenu partagé. Les tunnels clonés embarquent le HTML brut et le
 * <head> de la page source : on en a observé jusqu'à ~2 Mo. 6 Mo laisse une
 * marge confortable tout en évitant qu'un tunnel aberrant fasse expirer la
 * fonction serverless au milieu de l'insert.
 */
const MAX_SHARED_CONTENT_BYTES = 6 * 1024 * 1024;

const schema = z.object({
  funnelId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(400).optional(),
  ownerName: z.string().min(1).max(80),
});

export async function POST(req: Request) {
  // Authentification seule — aucun contrôle d'abonnement (cf. en-tête).
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message: "Ta session a expiré. Reconnecte-toi puis réessaie.",
      },
      { status: 401 },
    );
  }
  const userId = user.id;

  // Le garde d'abonnement servait aussi, incidemment, de frein au spam. En
  // l'ouvrant à tous, on le remplace par une limite explicite : 10 partages par
  // heure et par compte, largement au-dessus d'un usage normal.
  const rl = await rateLimit(`share-template:${userId}`, 10, 3600);
  if (!rl.ok) return tooManyRequests(600);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { funnelId, name, description, ownerName } = parsed.data;

  const admin = getSupabaseAdmin();
  const { data: funnel } = await admin
    .from("funnels")
    .select("user_id, json_content, language, funnel_type")
    .eq("id", funnelId)
    .maybeSingle();

  // 🐛 CAUSE PRINCIPALE DES « JE N'ARRIVE PAS À PARTAGER ».
  //
  // Le partage lit le tunnel dans Supabase, mais l'application laisse
  // parfaitement travailler sur un tunnel qui n'existe encore QUE dans le
  // localStorage : /api/clone-funnel ne persiste rien côté serveur, et la
  // synchro distante de `saveFunnel()` part en tâche de fond sans être
  // attendue. Un tunnel IMPORTÉ est justement le plus exposé — c'est le plus
  // volumineux (jusqu'à ~2 Mo observés), donc le plus lent à remonter et le
  // premier purgé par le quota localStorage.
  //
  // Résultat : la ligne n'existait pas, la route renvoyait un `not_found` sec,
  // et la modale affichait littéralement « not_found ». On distingue désormais
  // les deux situations et on explique quoi faire.
  if (!funnel) {
    return NextResponse.json(
      {
        ok: false,
        error: "funnel_not_synced",
        message:
          "Ce tunnel n'est pas encore enregistré sur le serveur. Enregistre-le " +
          "(bouton « Enregistrer »), attends la confirmation, puis relance le partage.",
      },
      { status: 409 },
    );
  }

  if (funnel.user_id !== userId) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_owner",
        message: "Seul le propriétaire d'un tunnel peut le partager dans la galerie.",
      },
      { status: 403 },
    );
  }

  const content = sanitizeFunnelForSharing(funnel.json_content);

  // Garde-fou de volume : un tunnel cloné embarque le HTML brut + le <head> de
  // la page source. Plutôt qu'un timeout opaque au milieu de l'insert, on
  // refuse tôt avec une consigne exploitable.
  const contentSize = JSON.stringify(content).length;
  if (contentSize > MAX_SHARED_CONTENT_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: "content_too_large",
        message:
          `Ce tunnel pèse ${Math.round(contentSize / 1024 / 1024 * 10) / 10} Mo, au-delà de la ` +
          `limite de partage (${MAX_SHARED_CONTENT_BYTES / 1024 / 1024} Mo). Allège-le en ` +
          `supprimant des sections clonées volumineuses, puis réessaie.`,
      },
      { status: 413 },
    );
  }

  const kind =
    (content?.meta?.funnelKind as string | undefined) ??
    (funnel.funnel_type as string | null) ??
    null;

  const { data, error } = await admin
    .from("shared_templates")
    .insert({
      owner_id: userId,
      owner_name: ownerName.trim().slice(0, 80),
      name: name.trim().slice(0, 120),
      description: description?.trim().slice(0, 400) || null,
      funnel_kind: kind,
      language: (funnel.language as string) ?? (content?.language as string) ?? "fr",
      content,
      status: "approved", // auto-approuvé + bouton « Signaler » côté galerie
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "share_failed", message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, id: data?.id });
}
