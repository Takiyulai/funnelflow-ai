// app/api/email/sending-domain/route.ts
// 🆕 MODULE PREMIUM — Domaine d'envoi personnalisé : état, déclaration, retrait.
//
// 🔒 Le contrôle de forfait est fait ICI, côté serveur, sur CHAQUE écriture.
// Masquer le bouton dans l'interface ne protège rien : un appel direct à
// l'API contournerait le masquage. La lecture (GET) reste ouverte à tout
// utilisateur connecté — elle sert justement à afficher « réservé au plan
// Pro » sans mentir sur l'état réel.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/billing/subscription";
import {
  getSendingDomain,
  createSendingDomain,
  removeSendingDomain,
  updateSendingLocalPart,
  SendingDomainError,
} from "@/lib/email/sendingDomain";

export const dynamic = "force-dynamic";

async function requireUser() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user;
}

function errorResponse(e: unknown) {
  if (e instanceof SendingDomainError) {
    // 4xx : l'utilisateur peut corriger sa saisie. Le message est déjà rédigé
    // pour être lisible tel quel dans l'interface.
    return NextResponse.json({ ok: false, error: e.code, message: e.message }, { status: 400 });
  }
  console.error("[sending-domain]", e);
  return NextResponse.json(
    { ok: false, error: "unexpected", message: "Une erreur inattendue est survenue." },
    { status: 500 },
  );
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const [state, access] = await Promise.all([
      getSendingDomain(user.id),
      getAccess(user.id),
    ]);
    return NextResponse.json(
      { ok: true, state, allowed: access.limits.customSendingDomain, planId: access.planId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const access = await getAccess(user.id);
  if (!access.limits.customSendingDomain) {
    return NextResponse.json(
      {
        ok: false,
        error: "plan_required",
        message: "Le domaine d'envoi personnalisé est inclus à partir du plan Pro.",
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  try {
    const localPart = typeof body.localPart === "string" ? body.localPart : "contact";

    // Sans `domain`, on ne change que l'adresse d'expédition : c'est le cas
    // « je veux passer de contact@ à bonjour@ », qui ne doit surtout pas
    // relancer une vérification DNS déjà validée.
    if (typeof body.domain !== "string" || !body.domain.trim()) {
      const state = await updateSendingLocalPart(user.id, localPart);
      return NextResponse.json({ ok: true, state });
    }

    const state = await createSendingDomain(user.id, body.domain, localPart);
    return NextResponse.json({ ok: true, state }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  // Pas de contrôle de forfait au retrait : un utilisateur rétrogradé doit
  // toujours pouvoir détacher son domaine. Le bloquer l'enfermerait dans un
  // état qu'il ne peut plus modifier.
  try {
    await removeSendingDomain(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
