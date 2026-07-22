// app/api/unsubscribe/route.ts
//
// 🆕 RGPD (audit #2) — Désinscription publique d'un lead aux emails marketing.
// Lien signé (voir lib/crm/unsubscribe.ts). GET → page de confirmation ;
// POST → one-click (en-tête List-Unsubscribe-Post). Idempotent.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyUnsubscribe } from "@/lib/crm/unsubscribe";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function doUnsubscribe(contactId: string, sig: string): Promise<boolean> {
  if (!UUID_RE.test(contactId) || !verifyUnsubscribe(contactId, sig)) return false;
  try {
    const admin = getSupabaseAdmin();
    await admin
      .from("leads")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("id", contactId)
      .is("unsubscribed_at", null); // idempotent : ne réécrit pas la date
    return true;
  } catch (e) {
    console.error("[unsubscribe] update échoué", e);
    return false;
  }
}

function pageHtml(ok: boolean): string {
  const title = ok ? "Désinscription confirmée" : "Lien invalide";
  const msg = ok
    ? "Tu ne recevras plus d'emails marketing de cette liste. Tu peux fermer cette page."
    : "Ce lien de désinscription est invalide ou a expiré.";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#0D1628;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
<div style="max-width:420px;text-align:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:32px">
<div style="font-size:40px;margin-bottom:12px">${ok ? "✅" : "⚠️"}</div>
<h1 style="font-size:20px;margin:0 0 10px">${title}</h1>
<p style="font-size:14px;color:rgba(255,255,255,.7);line-height:1.6;margin:0">${msg}</p>
</div></body></html>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("c") ?? "";
  const sig = searchParams.get("s") ?? "";
  const ok = await doUnsubscribe(contactId, sig);
  return new NextResponse(pageHtml(ok), {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// One-click (RFC 8058) : certains clients POSTent directement le lien.
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("c") ?? "";
  const sig = searchParams.get("s") ?? "";
  const ok = await doUnsubscribe(contactId, sig);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
