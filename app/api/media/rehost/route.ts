// app/api/media/rehost/route.ts
import { NextRequest, NextResponse } from "next/server";
import { downloadAndRehostMedia } from "@/lib/clone/media-downloader";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "URL invalide" }, { status: 400 });
    }

    const result = await downloadAndRehostMedia(url);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[/api/media/rehost]", err);
    return NextResponse.json(
      { error: err?.message || "Erreur serveur" },
      { status: 500 },
    );
  }
}
