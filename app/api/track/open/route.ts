// app/api/track/open/route.ts
// 🆕 VAGUE 1 / LOT 3 — Pixel d'ouverture email (1×1 GIF transparent).
// Journalise l'ouverture dans `email_events` puis renvoie TOUJOURS l'image
// (best-effort : aucune erreur de tracking ne casse l'affichage de l'email).
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GIF 1×1 transparent.
const GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SOURCE_TYPES = new Set(["newsletter", "sequence", "workflow", "delivery"]);

function uuidOrNull(v: string | null): string | null {
  return v && UUID_RE.test(v) ? v : null;
}

function gifResponse(): NextResponse {
  return new NextResponse(GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(GIF.length),
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = uuidOrNull(searchParams.get("uid"));
  const messageId = uuidOrNull(searchParams.get("m"));
  const contactId = uuidOrNull(searchParams.get("c"));
  const campaignId = uuidOrNull(searchParams.get("g"));
  const sequenceId = uuidOrNull(searchParams.get("s"));
  const sequenceEmailId = uuidOrNull(searchParams.get("se"));
  const rawType = searchParams.get("t");
  const sourceType = rawType && SOURCE_TYPES.has(rawType) ? rawType : null;

  // Sans userId + messageId valides, on sert juste l'image (rien à journaliser).
  if (userId && messageId) {
    try {
      const admin = getSupabaseAdmin();
      // 🔒 ANTI FAUX POSITIFS — Gmail (et d'autres) préchargent les images via
      // leur proxy AU MOMENT DE LA LIVRAISON (analyse antispam) : le pixel se
      // charge ~3 s après l'envoi sans qu'aucun humain n'ait ouvert l'email.
      // Constaté en prod : « ouverture » enregistrée 3 s après l'envoi d'un
      // email tombé en SPAM et jamais ouvert → la condition « n'a pas ouvert »
      // devenait fausse et la relance ne partait jamais. On ignore donc toute
      // ouverture survenant dans les 10 premières secondes après l'envoi réel
      // (un humain qui ouvre à +11 s reste compté).
      const { data: msg } = await admin
        .from("scheduled_emails")
        .select("sent_at")
        .eq("id", messageId)
        .maybeSingle();
      const sentMs = msg?.sent_at ? new Date(msg.sent_at as string).getTime() : NaN;
      if (Number.isFinite(sentMs) && Date.now() - sentMs < 10_000) {
        return gifResponse(); // préchargement automatique → pas un vrai « open »
      }
      await admin.from("email_events").insert({
        user_id: userId,
        kind: "open",
        source_type: sourceType,
        campaign_id: campaignId,
        sequence_id: sequenceId,
        sequence_email_id: sequenceEmailId,
        message_id: messageId,
        contact_id: contactId,
      });
    } catch {
      // best-effort : table absente ou erreur DB → l'image part quand même
    }
  }

  return gifResponse();
}
