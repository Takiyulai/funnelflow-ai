// app/api/webhooks/chariow/route.ts
// 🆕 Chariow — réception des Pulses (webhooks), ALIGNÉ SUR LEURS CONVENTIONS
// (cf. doc officielle chariow.dev/guides/pulses) :
//   - Événements : successful.sale, license.issued, license.activated,
//     license.expired, license.revoked (payload { event, sale, license,
//     product, customer, store }).
//   - Les Pulses ne sont PAS signés par Chariow → sécurité par TOKEN SECRET
//     dans l'URL (?token=CHARIOW_WEBHOOK_TOKEN) + RE-VALIDATION systématique
//     de la licence via l'API (source de vérité) avant toute activation.
//   - Toujours répondre 2xx rapidement (politique de retry Chariow) ;
//     idempotent (upsert par user_id / update par license_key).

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  validateChariowLicense,
  upsertUserLicense,
  markLicenseByKey,
} from "@/lib/billing/chariow";

export const dynamic = "force-dynamic";

type PulsePayload = {
  event?: string;
  sale?: { id?: string };
  license?: {
    id?: string;
    key?: string;
    status?: string;
    expires_at?: string | null;
  };
  product?: { id?: string; name?: string };
  customer?: { email?: string; name?: string };
  [k: string]: unknown;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Retrouve l'utilisateur AutoFunnel par email (admin API, paginé). */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  try {
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) break;
      const found = data.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      );
      if (found) return found.id;
      if (data.users.length < 200) break;
    }
  } catch (e) {
    console.error("[chariow-webhook] findUserIdByEmail error", e);
  }
  return null;
}

function authorized(request: Request): boolean {
  const secret = process.env.CHARIOW_WEBHOOK_TOKEN?.trim();
  if (!secret) return false; // pas de token configuré → on refuse par sécurité
  const url = new URL(request.url);
  return url.searchParams.get("token") === secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let payload: PulsePayload;
  try {
    payload = (await request.json()) as PulsePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const event = (payload.event ?? "").toLowerCase();
  const licenseKey = str(payload.license?.key);
  const email = str(payload.customer?.email);
  const productId = str(payload.product?.id);

  // 🆕 Instrumentation ciblée : ce webhook active/révoque l'accès payant des
  // utilisateurs → toute erreur inattendue doit remonter dans Sentry en
  // priorité (pas juste dans les logs). Jamais d'email/licence en clair dans
  // les tags (seulement des identifiants tronqués), et on répond toujours
  // 200 pour respecter la politique de retry de Chariow.
  try {
    // ── Licence expirée / révoquée → verrouillage local ──────────────────
    if (event === "license.expired" || event === "license.revoked") {
      if (licenseKey) {
        await markLicenseByKey(
          licenseKey,
          event === "license.expired" ? "expired" : "revoked",
        );
        console.log(`[chariow-webhook] ${event} → licence ${licenseKey.slice(0, 6)}… verrouillée.`);
      }
      return NextResponse.json({ ok: true });
    }

    // ── Vente / émission / activation de licence → activation locale ─────
    // (successful.sale porte aussi la licence quand le produit est de type License)
    if (
      event === "successful.sale" ||
      event === "license.issued" ||
      event === "license.activated"
    ) {
      if (!licenseKey) {
        // Vente d'un produit sans licence : rien à faire côté paywall.
        return NextResponse.json({ ok: true, skipped: "no_license_key" });
      }
      if (!email) {
        return NextResponse.json({ ok: true, skipped: "no_customer_email" });
      }

      // SOURCE DE VÉRITÉ : on ne fait jamais confiance au payload seul — la
      // licence est re-validée auprès de l'API Chariow avant activation.
      const check = await validateChariowLicense(licenseKey);
      if (!check.ok) {
        console.warn(
          `[chariow-webhook] ${event} reçu mais licence non valide côté API (${check.status}${check.error ? `, ${check.error}` : ""}).`,
        );
        Sentry.captureMessage("chariow-webhook: licence invalide côté API", {
          level: "warning",
          tags: { area: "chariow-webhook", event, apiStatus: String(check.status) },
        });
        return NextResponse.json({ ok: true, skipped: `api_status_${check.status}` });
      }

      const userId = await findUserIdByEmail(email);
      if (!userId) {
        // Le client n'a pas (encore) de compte AutoFunnel : la licence sera
        // activée quand il la saisira sur la page Abonnement (clé de licence).
        console.warn(`[chariow-webhook] aucun compte pour ${email} — activation différée.`);
        return NextResponse.json({ ok: true, deferred: true });
      }

      await upsertUserLicense({
        userId,
        licenseKey,
        status: "active",
        expiresAt: check.expiresAt ?? payload.license?.expires_at ?? null,
        productId: check.productId ?? productId,
      });
      console.log(`[chariow-webhook] licence activée pour user ${userId} (${event}).`);
      return NextResponse.json({ ok: true });
    }

    // Événement non géré (abandoned.sale, failed.sale, affiliate.joined…) :
    // 200 pour éviter les retries en boucle.
    return NextResponse.json({ ok: true, ignored: event || "unknown_event" });
  } catch (e) {
    console.error(`[chariow-webhook] erreur inattendue sur l'event ${event}:`, e);
    Sentry.captureException(e, {
      tags: { area: "chariow-webhook", event },
      extra: { licenseKeyPrefix: licenseKey?.slice(0, 6) ?? null },
    });
    // 200 quand même : Chariow réessaierait sinon en boucle sur une erreur
    // potentiellement persistante (ex: bug de code) sans que ça aide.
    return NextResponse.json({ ok: true, error: "internal_error" });
  }
}
