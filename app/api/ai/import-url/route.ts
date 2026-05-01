import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { url } = await request.json();
  return NextResponse.json({
    url,
    analysis: {
      sections: ["hero", "problem", "offer", "proof", "cta"],
      warning: "Analyse structurelle uniquement : aucun texte, image ou branding tiers n’est copié."
    }
  });
}
