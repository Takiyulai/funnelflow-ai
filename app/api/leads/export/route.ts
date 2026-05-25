import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const funnelId = url.searchParams.get("funnelId");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let query = supabase
    .from("leads")
    .select(
      "email, name, phone, status, page_slug, section_id, consent, language, created_at, funnels(name, slug)",
    )
    .order("created_at", { ascending: false })
    .limit(10000);

  if (funnelId) query = query.eq("funnel_id", funnelId);

  const { data: leads, error } = await query;

  if (error) {
    console.error("[api/leads/export] error", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const headers = [
    "email",
    "name",
    "phone",
    "status",
    "funnel_name",
    "funnel_slug",
    "page_slug",
    "section_id",
    "consent",
    "language",
    "created_at",
  ];

  const rows = (leads ?? []).map((l) => {
    const funnelObj = Array.isArray(l.funnels)
      ? (l.funnels[0] as { name?: string; slug?: string } | undefined)
      : (l.funnels as { name?: string; slug?: string } | null | undefined);
    return [
      l.email,
      l.name,
      l.phone,
      l.status,
      funnelObj?.name,
      funnelObj?.slug,
      l.page_slug,
      l.section_id,
      l.consent,
      l.language,
      l.created_at,
    ];
  });

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ].join("\n");

  // BOM UTF-8 pour Excel
  const body = "\ufeff" + csv;

  const filename = funnelId
    ? `leads-funnel-${funnelId.slice(0, 8)}-${Date.now()}.csv`
    : `leads-all-${Date.now()}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
