import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CloudinaryNotConfiguredError,
  createDirectUploadSignature,
} from "@/lib/media/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeSegment(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9\-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || fallback
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Session expirée." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    funnelId?: unknown;
    spotId?: unknown;
    publicId?: unknown;
  };
  const publicId =
    typeof body.publicId === "string" && /^[a-f0-9]{32}$/i.test(body.publicId)
      ? body.publicId.toLowerCase()
      : null;
  if (!publicId) {
    return NextResponse.json(
      { ok: false, error: "Empreinte du fichier invalide." },
      { status: 400 },
    );
  }

  const funnelId = safeSegment(body.funnelId, "editor");
  const spotId = safeSegment(body.spotId, "video");
  const userFolder = safeSegment(user.id, "user");

  try {
    const signed = createDirectUploadSignature({
      folder: `uploads/${userFolder}/${funnelId}/${spotId}`,
      publicId,
    });
    return NextResponse.json({ ok: true, ...signed });
  } catch (error) {
    const message =
      error instanceof CloudinaryNotConfiguredError
        ? error.message
        : "Impossible de préparer l'envoi de la vidéo.";
    console.error("[/api/media/upload-signature]", error);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
