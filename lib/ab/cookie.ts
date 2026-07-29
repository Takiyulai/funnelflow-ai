// lib/ab/cookie.ts
//
// 🆕 MODULE 3 — Nom du cookie d'identification visiteur pour l'A/B testing.
//
// Isolé dans son propre fichier parce qu'il est importé par le MIDDLEWARE, qui
// s'exécute sur le runtime Edge. Tout ce que le middleware importe est embarqué
// dans son bundle : le faire pointer vers `lib/ab/tests.ts` y tirerait le SDK
// Supabase et les types de tunnels, pour une seule constante.

/** Cookie posé par le middleware sur /tunnel/*. UUID aléatoire, rien d'autre. */
export const AB_COOKIE = "ff_ab";
