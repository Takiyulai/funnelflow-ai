// lib/observability/sentryScrub.ts
//
// 🆕 Nettoyage des événements Sentry AVANT envoi (beforeSend / beforeSendTransaction).
//
// But : ne JAMAIS laisser partir vers Sentry des secrets serveur (clés API,
// tokens, service role Supabase…), des en-têtes d'authentification/cookies,
// ou des données personnelles clients (email complet, corps de requête de
// paiement — numéro de carte, apikey CinetPay, etc.).
//
// Partagé entre sentry.server.config.ts, sentry.edge.config.ts et
// instrumentation-client.ts pour éviter toute divergence entre runtimes.
//
// ⚠️ Typé en `unknown` volontairement : les noms exacts des types d'event
// Sentry varient selon la version du SDK (`ErrorEvent`, `Event`, `TransactionEvent`…).
// On évite d'importer ces types et de risquer une casse de build ; l'appelant
// recast simplement le retour vers son propre type (`as typeof event`).

/** Clés (insensibles à la casse) dont la VALEUR est toujours remplacée. */
const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|set-cookie|token|secret|api[-_]?key|apikey|password|passwd|service[-_]?role|stripe[-_]?signature|x-api-key|webhook)/i;

/**
 * Chemins d'API dont le corps de requête ENTIER est retiré (paiement /
 * webhooks) plutôt que simplement filtré champ par champ : trop de champs
 * sensibles imbriqués (métadonnées Stripe, apikey CinetPay, payload licence…)
 * pour se fier à un filtrage partiel.
 */
const SENSITIVE_ROUTE_PATTERN =
  /\/api\/(checkout|stripe\/webhook|cinetpay\/(notify|connect)|webhooks\/chariow|billing\/portal|license\/validate|subscribe|connect\/onboard)/i;

const EMAIL_PATTERN = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

const REDACTED = "[Filtered]";
const MAX_DEPTH = 6;

/** Masque un email complet en ne gardant que la 1ère lettre + le domaine. */
function maskEmails(value: string): string {
  return value.replace(EMAIL_PATTERN, (_match, local: string, domain: string) => {
    const visible = local.slice(0, 1) || "*";
    return `${visible}***@${domain}`;
  });
}

function scrubValue(key: string, value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return REDACTED;
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (typeof value === "string") return maskEmails(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(key, v, depth + 1));
  if (value && typeof value === "object") {
    return scrubObject(value as Record<string, unknown>, depth + 1);
  }
  return value;
}

function scrubObject(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = scrubValue(k, v, depth);
  }
  return out;
}

function getUrl(request: Record<string, unknown>): string {
  const url = request.url;
  return typeof url === "string" ? url : "";
}

/**
 * Nettoie un événement Sentry (error ou transaction) avant envoi. À appeler
 * depuis `beforeSend` / `beforeSendTransaction` dans les 3 configs runtime.
 */
export function scrubSentryEvent(rawEvent: unknown): unknown {
  if (!rawEvent || typeof rawEvent !== "object") return rawEvent;
  const event = rawEvent as Record<string, unknown>;

  // 1. Requête HTTP : headers (Authorization…), cookies, corps.
  const request = event.request;
  if (request && typeof request === "object") {
    const req = request as Record<string, unknown>;

    if (req.headers && typeof req.headers === "object") {
      req.headers = scrubObject(req.headers as Record<string, unknown>);
    }
    // Les cookies bruts ne doivent jamais partir vers Sentry, quelle que soit
    // leur forme (objet ou chaîne "a=b; c=d").
    if ("cookies" in req) {
      delete req.cookies;
    }
    if (req.headers && typeof req.headers === "object" && "cookie" in (req.headers as object)) {
      (req.headers as Record<string, unknown>).cookie = REDACTED;
    }

    if (req.data !== undefined && req.data !== null) {
      const url = getUrl(req);
      if (SENSITIVE_ROUTE_PATTERN.test(url)) {
        // Route paiement / webhook : on retire le corps entier (numéro de
        // carte, apikey CinetPay, token de licence, email complet…).
        req.data = "[Filtered:sensitive-route-body]";
      } else if (typeof req.data === "object") {
        req.data = scrubObject(req.data as Record<string, unknown>);
      } else if (typeof req.data === "string") {
        req.data = maskEmails(req.data);
      }
    }

    event.request = req;
  }

  // 2. Utilisateur : jamais d'email complet ni d'IP précise.
  const user = event.user;
  if (user && typeof user === "object") {
    const u = user as Record<string, unknown>;
    if (typeof u.email === "string") u.email = maskEmails(u.email);
    delete u.ip_address;
    event.user = u;
  }

  // 3. extra / contexts : peuvent contenir des payloads bruts attachés à la
  // main par du code applicatif (ex: Sentry.captureException(e, { extra })).
  if (event.extra && typeof event.extra === "object") {
    event.extra = scrubObject(event.extra as Record<string, unknown>);
  }
  if (event.contexts && typeof event.contexts === "object") {
    const contexts = event.contexts as Record<string, unknown>;
    for (const key of Object.keys(contexts)) {
      const ctx = contexts[key];
      if (ctx && typeof ctx === "object") {
        contexts[key] = scrubObject(ctx as Record<string, unknown>);
      }
    }
    event.contexts = contexts;
  }

  // 4. Breadcrumbs (fetch/xhr/console peuvent capturer headers/bodies/emails).
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => {
      if (!crumb || typeof crumb !== "object") return crumb;
      const c = { ...(crumb as Record<string, unknown>) };
      if (c.data && typeof c.data === "object") {
        c.data = scrubObject(c.data as Record<string, unknown>);
      }
      if (typeof c.message === "string") {
        c.message = maskEmails(c.message);
      }
      return c;
    });
  }

  // 5. Filet de sécurité : messages/exceptions ne doivent jamais contenir un
  // email complet (ex: `throw new Error(\`Échec pour ${email}\`)`).
  if (typeof event.message === "string") {
    event.message = maskEmails(event.message);
  }
  const exception = event.exception;
  if (exception && typeof exception === "object" && Array.isArray((exception as Record<string, unknown>).values)) {
    const values = (exception as Record<string, unknown>).values as unknown[];
    (exception as Record<string, unknown>).values = values.map((v) => {
      if (!v || typeof v !== "object") return v;
      const val = { ...(v as Record<string, unknown>) };
      if (typeof val.value === "string") val.value = maskEmails(val.value);
      return val;
    });
    event.exception = exception;
  }

  return event;
}
