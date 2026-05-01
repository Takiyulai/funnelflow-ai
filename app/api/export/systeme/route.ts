import { NextResponse } from "next/server";
import { createHtmlZipBase64 } from "@/lib/export/html";
import { demoFunnel } from "@/lib/funnels/demo";

export async function GET() {
  const base64 = createHtmlZipBase64(demoFunnel);
  const bytes = Buffer.from(base64, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=funnelflow-export.zip"
    }
  });
}
