// app/api/revalidate-tunnel/route.ts
// 🆕 Chantier 3 — revalidation ON-DEMAND de la page publique d'un tunnel après
// (re)publication. Appelée par l'éditeur. Auth requise (utilisateur connecté)
// pour éviter tout déclenchement anonyme. Couplée à l'ISR (revalidate=60), elle
// rend la mise à jour INSTANTANÉE après publication, sinon 60s max de latence.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ slug: z.string().min(1).max(120) });

export async function POST(req: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let slug: string;
  try {
    slug = bodySchema.parse(await req.json()).slug.replace(/^\/+|\/+$/g, "");
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
  }

  // 'layout' → revalide la page d'accueil du tunnel ET ses sous-pages.
  revalidatePath(`/tunnel/${slug}`, "layout");
  return NextResponse.json({ ok: true });
}
