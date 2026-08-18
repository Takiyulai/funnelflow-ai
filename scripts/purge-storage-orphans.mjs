#!/usr/bin/env node
/**
 * scripts/purge-storage-orphans.mjs
 *
 * Supprime du bucket `cloned-funnels-media` les fichiers qui ne sont
 * référencés par AUCUN tunnel, modèle partagé ou test A/B.
 *
 * ── POURQUOI UN SCRIPT ET PAS LE DASHBOARD ──────────────────────────────────
 * Les dossiers à nettoyer sont « mixtes » : 2 411 fichiers à supprimer y
 * côtoient 61 fichiers encore utilisés par des tunnels publiés. Le plus gros
 * dossier contient 971 fichiers dont 10 à garder. Cocher les cases une à une
 * dans le dashboard n'est pas une méthode : une erreur de clic casse une page
 * en production.
 *
 * ── POURQUOI PAS DE SQL ─────────────────────────────────────────────────────
 * `delete from storage.objects` ne retire que la ligne de métadonnées. Le
 * fichier reste sur S3 et le quota ne bouge pas — pire, l'objet devient
 * invisible et donc impossible à supprimer proprement ensuite. Seule l'API
 * Storage libère réellement l'espace.
 *
 * ── GARDE-FOU CENTRAL ───────────────────────────────────────────────────────
 * Le script ne reçoit AUCUNE liste toute faite. Il recalcule lui-même
 * l'ensemble des fichiers référencés, puis supprime le complément. Si ce
 * recalcul échoue ou renvoie un résultat anormalement bas, tout le bucket
 * paraîtrait orphelin : le script s'arrête alors avant la moindre suppression
 * (voir MIN_REFERENCES).
 *
 * Usage :
 *   node scripts/purge-storage-orphans.mjs           → simulation
 *   node scripts/purge-storage-orphans.mjs --apply   → suppression réelle
 *
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const BUCKET = "cloned-funnels-media";

/**
 * Plancher de sécurité. Au moment du diagnostic (17 août 2026) le bucket
 * comptait 965 fichiers référencés. Si l'extraction en trouve beaucoup moins,
 * c'est que quelque chose a cassé (schéma modifié, lecture partielle, RLS) —
 * PAS que les tunnels ont cessé d'utiliser leurs images. Dans le doute on ne
 * supprime rien : une suppression de masse est irréversible.
 */
const MIN_REFERENCES = 500;

/** Refuse d'effacer plus que cette part du bucket en une fois. */
const MAX_DELETE_RATIO = 0.85;

const APPLY = process.argv.includes("--apply");

/* ------------------------------------------------------------------ */
/*  Environnement                                                      */
/* ------------------------------------------------------------------ */

function loadEnv() {
  // .env.local n'est pas chargé automatiquement hors Next : on le lit à la
  // main, sans jamais l'écrire ni l'afficher.
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      /* fichier absent : normal */
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises.",
  );
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

/* ------------------------------------------------------------------ */
/*  1. Ensemble des fichiers RÉFÉRENCÉS                                */
/* ------------------------------------------------------------------ */

const PATH_RE = new RegExp(`${BUCKET}/([A-Za-z0-9._/%~-]+)`, "g");

/**
 * ⚠️ NE PAS RÉDUIRE CETTE LISTE — et surtout, ne pas y chercher
 * « published_content ».
 *
 * `published_content` N'EST PAS UNE TABLE : c'est une colonne `jsonb` de
 * `funnels` (vérifié le 17 août 2026 — aucune table du schéma `public` ne porte
 * ce nom). Elle est donc couverte par le scan de `funnels`, qui sérialise la
 * ligne ENTIÈRE.
 *
 * Ce point est critique : 91 chemins y figurent, dont 10 ne sont référencés
 * NULLE PART AILLEURS. Ce sont des images de pages publiées dont la version de
 * travail a depuis changé. Scanner `funnels` colonne par colonne, en oubliant
 * celle-là, détruirait 10 images sur des pages en ligne.
 *
 * Ces trois tables sont les seules du schéma `public` à contenir la chaîne
 * `cloned-funnels-media` (balayage exhaustif de toutes les tables, même date) :
 *   funnels (29 lignes) · shared_templates (2) · funnel_ab_tests (2)
 */
const TABLES = ["funnels", "shared_templates", "funnel_ab_tests"];

/**
 * ── POURQUOI DES PAGES MINUSCULES ───────────────────────────────────────────
 * Mesuré le 17 août 2026 :
 *   funnels          59 lignes ·   62 Mo au total · plus grosse ligne 9,45 Mo
 *   shared_templates 12 lignes · 1,68 Mo
 *   funnel_ab_tests   2 lignes ·   12 ko
 *
 * `select("*")` par pages de 200 demandait donc les 62 Mo de `funnels` en une
 * seule réponse : le serveur abandonnait sur `statement timeout`. Une seule
 * ligne pesant déjà 9,45 Mo, aucune taille de page « raisonnable » n'est sûre
 * dans l'absolu — d'où une page de départ très petite, qui se réduit d'elle-même
 * jusqu'à 1 en cas de dépassement.
 *
 * ⚠️ On garde `select("*")`. Ne PAS restreindre aux colonnes qui contiennent
 * des chemins aujourd'hui : une colonne oubliée fait supprimer des fichiers
 * encore utilisés, alors qu'un scan lent ne coûte que du temps.
 */
const START_PAGE = 3;
const PAUSE_MS = 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 57014 = canceling statement due to statement timeout. */
function isTimeout(error) {
  return (
    error?.code === "57014" ||
    /timeout|canceling statement/i.test(error?.message ?? "")
  );
}

/** Ajoute au Set tous les chemins Storage trouvés dans une ligne. */
function harvest(row, found) {
  for (const m of JSON.stringify(row).matchAll(PATH_RE)) {
    // JSON.stringify échappe les slashes dans certaines valeurs : on
    // normalise pour comparer à un nom d'objet Storage.
    found.add(m[1].replace(/\\\//g, "/"));
  }
}

/**
 * Lit une table page par page et récolte les chemins.
 *
 * `order("id")` n'est pas décoratif : sans tri explicite, PostgreSQL ne
 * garantit aucun ordre entre deux requêtes, et `range()` pourrait alors sauter
 * une ligne. Une ligne sautée = ses images considérées orphelines = supprimées.
 *
 * @param {string} table
 * @param {string} columns  `*` pour le scan complet, une colonne pour un contrôle.
 */
async function scanTable(table, columns = "*") {
  const found = new Set();
  let size = START_PAGE;
  let from = 0;
  let lignes = 0;

  for (;;) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + size - 1);

    if (error) {
      // Page trop lourde : on la coupe en deux et on rejoue le MÊME offset.
      if (isTimeout(error) && size > 1) {
        size = Math.max(1, Math.floor(size / 2));
        process.stdout.write(`\r    ${table} : page réduite à ${size} ligne(s)…   `);
        await sleep(PAUSE_MS);
        continue;
      }
      // Toute autre erreur — ou un timeout même à 1 ligne — est fatale.
      // Continuer avec des références partielles ferait supprimer des fichiers
      // encore utilisés : on préfère ne rien faire.
      throw new Error(
        `${table} : ${error.message}` +
          (isTimeout(error)
            ? "\n   Une seule ligne dépasse le statement timeout. " +
              "Augmenter le timeout côté Supabase avant de relancer."
            : ""),
      );
    }

    if (!data || data.length === 0) break;
    for (const row of data) harvest(row, found);
    lignes += data.length;
    process.stdout.write(`\r    ${table} : ${lignes} lignes lues…        `);

    if (data.length < size) break;
    from += data.length;
    await sleep(PAUSE_MS);
  }

  process.stdout.write("\r".padEnd(60) + "\r");
  return { found, lignes };
}

/* ------------------------------------------------------------------ */
/*  2. Inventaire du bucket                                            */
/* ------------------------------------------------------------------ */

/** `list()` ne descend pas dans les sous-dossiers : on récurse. */
async function listAll(prefix = "") {
  const out = [];
  const PAGE = 100;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`list(${prefix}) : ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Un dossier n'a pas de métadonnées : c'est ainsi que l'API les distingue.
      if (entry.id === null || entry.metadata === null) {
        out.push(...(await listAll(full)));
      } else {
        out.push({ name: full, size: entry.metadata?.size ?? 0 });
      }
    }
    if (data.length < PAGE) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  3. Exécution                                                       */
/* ------------------------------------------------------------------ */

const mo = (bytes) => `${(bytes / 1048576).toFixed(1)} Mo`;

async function main() {
  console.log(
    `\n${APPLY ? "🔴 MODE SUPPRESSION" : "🟢 SIMULATION (ajouter --apply pour supprimer)"}\n`,
  );

  console.log("Lecture des références…");
  const referenced = new Set();
  for (const table of TABLES) {
    const { found, lignes } = await scanTable(table);
    console.log(`  ${table} : ${lignes} lignes, ${found.size} chemins`);
    for (const p of found) referenced.add(p);
  }
  console.log(`  → ${referenced.size} fichiers référencés distincts`);

  // Contrôle de couverture de `funnels.published_content`.
  //
  // C'est la colonne dont l'oubli coûterait le plus cher : elle porte des
  // images de pages EN LIGNE que la version de travail ne cite plus. Le scan
  // de la ligne entière devrait forcément les inclure — mais si une
  // régression future rendait `published_content` invisible (colonne renommée,
  // sélection restreinte, permission), la perte serait silencieuse. On le
  // vérifie donc explicitement à chaque exécution.
  // Relecture ciblée, paginée elle aussi : `published_content` est la colonne
  // la plus lourde de la base, la tirer d'un coup provoquerait le timeout que
  // ce correctif vient d'éliminer.
  const { found: pubPaths } = await scanTable("funnels", "id, published_content");
  console.log(`  contrôle published_content : ${pubPaths.size} chemins`);

  const manquants = [...pubPaths].filter((p) => !referenced.has(p));

  if (pubPaths.size === 0) {
    console.error(
      "\n❌ ARRÊT : published_content ne produit aucun chemin, alors qu'il " +
        "devrait en produire 91 (relevé du 17 août 2026). Le scan est " +
        "incomplet — ne rien supprimer.",
    );
    process.exit(1);
  }
  if (manquants.length > 0) {
    console.error(
      `\n❌ ARRÊT : ${manquants.length} chemins de published_content absents ` +
        "de l'ensemble référencé. Le scan principal est incomplet.",
    );
    for (const p of manquants.slice(0, 5)) console.error(`   - ${p}`);
    process.exit(1);
  }

  if (referenced.size < MIN_REFERENCES) {
    console.error(
      `\n❌ ARRÊT : seulement ${referenced.size} références trouvées ` +
        `(plancher : ${MIN_REFERENCES}).\n` +
        "   L'extraction a probablement échoué. Aucune suppression effectuée.",
    );
    process.exit(1);
  }

  console.log("\nInventaire du bucket…");
  const objects = await listAll();
  const orphans = objects.filter((o) => !referenced.has(o.name));

  const totalBytes = objects.reduce((s, o) => s + o.size, 0);
  const freedBytes = orphans.reduce((s, o) => s + o.size, 0);

  console.log(`  ${objects.length} fichiers, ${mo(totalBytes)}`);
  console.log(`  ${orphans.length} orphelins, ${mo(freedBytes)} à libérer`);
  console.log(`  → restera ${mo(totalBytes - freedBytes)}\n`);

  const ratio = objects.length ? orphans.length / objects.length : 0;
  if (ratio > MAX_DELETE_RATIO) {
    console.error(
      `❌ ARRÊT : ${Math.round(ratio * 100)} % du bucket serait supprimé ` +
        `(plafond : ${MAX_DELETE_RATIO * 100} %).\n` +
        "   Vérifier manuellement avant de forcer.",
    );
    process.exit(1);
  }

  if (!APPLY) {
    console.log("Aperçu des 15 premiers fichiers concernés :");
    for (const o of orphans.slice(0, 15)) console.log(`  - ${o.name}`);
    if (orphans.length > 15) console.log(`  … et ${orphans.length - 15} autres`);
    console.log("\nRien n'a été supprimé. Relancer avec --apply.\n");
    return;
  }

  // Suppression par lots : l'API plafonne le nombre de chemins par appel, et
  // un lot qui échoue ne doit pas emporter les suivants.
  const BATCH = 100;
  let done = 0;
  let failed = 0;
  for (let i = 0; i < orphans.length; i += BATCH) {
    const paths = orphans.slice(i, i + BATCH).map((o) => o.name);
    const { error } = await sb.storage.from(BUCKET).remove(paths);
    if (error) {
      failed += paths.length;
      console.error(`  ❌ lot ${i / BATCH + 1} : ${error.message}`);
    } else {
      done += paths.length;
      process.stdout.write(`\r  supprimés : ${done}/${orphans.length}`);
    }
  }
  console.log(
    `\n\n✅ ${done} fichiers supprimés, ${mo(freedBytes)} libérés.` +
      (failed ? ` ⚠️ ${failed} échecs.` : ""),
  );
  console.log(
    "   Le quota Supabase se recalcule avec quelques minutes de décalage.\n",
  );
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
