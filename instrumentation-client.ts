// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/sentryScrub";

Sentry.init({
  dsn: "https://74b9567ce9f9fc49d030de237f8e1d27@o4511707858731008.ingest.us.sentry.io/4511707877539840",

  // 🆕 Session Replay : on masque TOUT le texte saisi et on bloque TOUS les
  // médias (images/vidéos) pour ne jamais enregistrer d'email, de nom ou de
  // donnée client dans une session rejouée. Ne pas repasser à false — c'est
  // une exigence de confidentialité, pas juste une option de perf.
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },

  // 🆕 Sécurité : même scrubbing que côté serveur (headers d'auth, cookies,
  // corps de requête paiement/webhook, emails complets). Voir
  // lib/observability/sentryScrub.ts.
  beforeSend(event) {
    return scrubSentryEvent(event) as typeof event;
  },
  beforeSendTransaction(event) {
    return scrubSentryEvent(event) as typeof event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
