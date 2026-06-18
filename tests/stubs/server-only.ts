// Stub de test pour le package "server-only".
// En production, "server-only" lève une erreur si un module serveur est importé
// côté client. Dans l'environnement vitest (jsdom), ce package n'est pas
// résolvable : on le remplace par un module vide via l'alias de vitest.config.ts.
export {};
