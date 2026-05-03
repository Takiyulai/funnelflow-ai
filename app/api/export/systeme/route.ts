// app/api/export/systeme/route.ts
import { NextResponse } from "next/server";
import {
  createHtmlZipBase64,
  renderFunnelHtml,
  createSystemeBlocks,
  createSystemeFormBlock,
} from "@/lib/export/html";
import { demoFunnel } from "@/lib/funnels/demo";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const blockId = url.searchParams.get("blockId");

  // Mode "full" : HTML complet en texte brut
  if (mode === "full") {
    const html = renderFunnelHtml(demoFunnel);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": 'inline; filename="funnel-complet.html"',
      },
    });
  }

  // Mode "block" : retourne un bloc précis
  if (mode === "block" && blockId) {
    const blocks = [...createSystemeBlocks(demoFunnel), createSystemeFormBlock(demoFunnel)];
    const block = blocks.find((b) => b.id === blockId);
    if (!block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }
    return new NextResponse(block.html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Mode par défaut : ZIP complet
  const base64 = createHtmlZipBase64(demoFunnel);
  const bytes = Buffer.from(base64, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="funnelflow-export.zip"',
    },
  });
}
