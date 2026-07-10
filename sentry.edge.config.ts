// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/sentryScrub";

Sentry.init({
  dsn: "https://74b9567ce9f9fc49d030de237f8e1d27@o4511707858731008.ingest.us.sentry.io/4511707877539840",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },

  // 🆕 Sécurité : même scrubbing que sentry.server.config.ts (headers d'auth,
  // cookies, corps de requête paiement/webhook, emails complets).
  beforeSend(event) {
    return scrubSentryEvent(event) as typeof event;
  },
  beforeSendTransaction(event) {
    return scrubSentryEvent(event) as typeof event;
  },
});
