import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { section } = await request.json();
  return NextResponse.json({
    section: {
      ...section,
      headline: `${section?.headline ?? "Section"} - version optimisée`,
      body: "Version régénérée pour renforcer la clarté, le désir et l’action."
    }
  });
}
