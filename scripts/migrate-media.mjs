#!/usr/bin/env node
/**
 * scripts/migrate-media.mjs
 *
 * 🆕 MIGRATION STOCKAGE — Supabase Storage → Cloudinary.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTEXTE. Le bucket `cloned-funnels-media` atteignait 1,46 Go sur 1 Go
 * autorisés (149 %), avec restriction des requêtes annoncée au 12 août 2026.
 * Sur 5 549 fichiers, 3 441 (1 293 Mo) sont encore référencés par des tunnels :
 * les supprimer casserait les pages publiées. Il faut donc les déplacer, pas
 * les jeter.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TROIS COMMANDES, DANS CET ORDRE. La suppression est VOLONTAIREMENT séparée :
 * elle est irréversible et ne doit jamais partir dans la foulée d'une migration
 * non vérifiée.
 *
 *   node scripts/migrate-media.mjs plan
 *       Lecture seule. Inventaire, estimation, liste des fichiers non
 *       référencés. N'écrit rien, nulle part.
 *
 *   node scripts/migrate-media.mjs migrate [--limit=N] [--dry-run]
 *       Migre vers Cloudinary et met à jour les URL en base.
 *       Ne supprime RIEN côté Supabase.
 *
 *   node scripts/migrate-media.mjs purge --confirm
 *       ⚠️ IRRÉVERSIBLE. Supprime de Supabase les fichiers dont la migration
 *       est confirmée. Refuse de s'exécuter sans --confirm.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IDEMPOTENCE. L'identifiant Cloudinary est l'empreinte SHA-256 du contenu :
 * relancer le script ne recrée rien et ne double aucune facture. Les URL déjà
 * migrées sont détectées et ignorées.
 */

import { createClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from "cloudinary";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BUCKET = "cloned-funnels-media";
const CLOUDINARY_ROOT = "autofunnel";
/** Journal de correspondance ancienne URL → nouvelle. Rend le script rejouable
 *  et sert de garde-fou à la purge : on ne supprime que ce qui y figure. */
const LEDGER = "scripts/.media-migration-ledger.json";
const BATCH = 5;

// ── Environnement ───────────────────────────────────────────────────────────
const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

function requireEnv() {
  const missing = [];
  if (!NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!CLOUDINARY_CLOUD_NAME) missing.push("CLOUDINARY_CLOUD_NAME");
  if (!CLOUDINARY_API_KEY) missing.push("CLOUDINARY_API_KEY");
  if (!CLOUDINARY_API_SECRET) missing.push("CLOUDINARY_API_SECRET");
  if (missing.length) {
    console.error(`\n❌ Variables manquantes : ${missing.join(", ")}`);
    console.error("   Lance le script avec ton .env.local chargé, par exemple :");
    console.error("   node --env-file=.env.local scripts/migrate-media.mjs plan\n");
    process.exit(1);
  }
}

const sb = () =>
  createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

function configureCloudinary() {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// ── Journal ─────────────────────────────────────────────────────────────────
function loadLedger() {
  if (!existsSync(LEDGER)) return { migrated: {}, startedAt: null };
  try {
    return JSON.parse(readFileSync(LEDGER, "utf8"));
  } catch {
    console.warn("⚠️  Journal illisible, on repart d'un journal vide.");
    return { migrated: {}, startedAt: null };
  }
}

function saveLedger(ledger) {
  writeFileSync(LEDGER, JSON.stringify(ledger, null, 2), "utf8");
}

// ── Inventaire ──────────────────────────────────────────────────────────────

/** Liste TOUS les objets du bucket (pagination récursive par dossier). */
async function listAllObjects(client) {
  const out = [];
  async function walk(prefix) {
    let offset = 0;
    for (;;) {
      const { data, error } = await client.storage
        .from(BUCKET)
        .list(prefix, { limit: 100, offset });
      if (error) throw new Error(`list(${prefix}) : ${error.message}`);
      if (!data || data.length === 0) break;
      for (const entry of data) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        // Un dossier n'a pas de métadonnées : on descend dedans.
        if (!entry.id && !entry.metadata) await walk(path);
        else out.push({ path, size: entry.metadata?.size ?? 0 });
      }
      if (data.length < 100) break;
      offset += 100;
    }
  }
  await walk("");
  return out;
}

function publicUrlOf(path) {
  return `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Charge tous les tunnels avec leur contenu (brouillon + publié). */
async function loadFunnels(client) {
  const { data, error } = await client
    .from("funnels")
    .select("id, json_content, published_content");
  if (error) throw new Error(`lecture funnels : ${error.message}`);
  return data ?? [];
}

function isReferenced(path, funnels) {
  return funnels.some(
    (f) =>
      JSON.stringify(f.json_content ?? "").includes(path) ||
      JSON.stringify(f.published_content ?? "").includes(path),
  );
}

// ── Commande : plan ─────────────────────────────────────────────────────────
async function cmdPlan() {
  const client = sb();
  console.log("\n📊 Inventaire du bucket…\n");

  const objects = await listAllObjects(client);
  const funnels = await loadFunnels(client);
  const ledger = loadLedger();

  let referenced = 0;
  let referencedBytes = 0;
  let orphan = 0;
  let orphanBytes = 0;
  let already = 0;

  const orphanList = [];

  for (const o of objects) {
    if (ledger.migrated[o.path]) already++;
    if (isReferenced(o.path, funnels)) {
      referenced++;
      referencedBytes += o.size;
    } else {
      orphan++;
      orphanBytes += o.size;
      orphanList.push(o.path);
    }
  }

  const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} Mo`;

  console.log(`   Fichiers totaux        : ${objects.length}`);
  console.log(`   Déjà migrés (journal)  : ${already}`);
  console.log(`   Référencés (à migrer)  : ${referenced} — ${mb(referencedBytes)}`);
  console.log(`   NON référencés         : ${orphan} — ${mb(orphanBytes)}`);
  console.log("");
  console.log("   Les fichiers non référencés ne seront PAS migrés :");
  console.log("   les envoyer chez Cloudinary consommerait des crédits pour");
  console.log("   des médias que plus aucun tunnel n'affiche.");
  console.log("");
  console.log("   Aperçu des 10 premiers non référencés :");
  orphanList.slice(0, 10).forEach((p) => console.log(`     · ${p}`));
  if (orphanList.length > 10) console.log(`     … et ${orphanList.length - 10} autres`);
  console.log("\n   Rien n'a été modifié.\n");
}

// ── Commande : migrate ──────────────────────────────────────────────────────
async function cmdMigrate({ dryRun, limit }) {
  configureCloudinary();
  const client = sb();
  const ledger = loadLedger();
  ledger.startedAt ??= new Date().toISOString();

  console.log(`\n🚚 Migration${dryRun ? " (DRY-RUN — rien ne sera écrit)" : ""}…\n`);

  const objects = await listAllObjects(client);
  const funnels = await loadFunnels(client);

  const todo = objects
    .filter((o) => !ledger.migrated[o.path])
    .filter((o) => isReferenced(o.path, funnels));
  const slice = limit ? todo.slice(0, limit) : todo;

  console.log(`   ${todo.length} fichier(s) à migrer, traitement de ${slice.length}.\n`);

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < slice.length; i += BATCH) {
    const batch = slice.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (obj) => {
        try {
          const { data, error } = await client.storage.from(BUCKET).download(obj.path);
          if (error || !data) throw new Error(error?.message ?? "téléchargement vide");
          const buffer = Buffer.from(await data.arrayBuffer());
          const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 32);
          const mime = data.type || "image/jpeg";
          const resourceType = mime.startsWith("video/") ? "video" : "image";

          if (dryRun) {
            console.log(`   [dry] ${obj.path} → ${CLOUDINARY_ROOT}/migrated/${hash}`);
            ok++;
            return;
          }

          const res = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                folder: `${CLOUDINARY_ROOT}/migrated`,
                public_id: hash,
                resource_type: resourceType,
                overwrite: false,
                unique_filename: false,
              },
              (err, result) =>
                err ? reject(new Error(err.message)) : resolve(result),
            );
            stream.end(buffer);
          });

          const newUrl =
            mime === "image/svg+xml"
              ? cloudinary.url(res.public_id, { resource_type: resourceType, secure: true })
              : cloudinary.url(res.public_id, {
                  resource_type: resourceType,
                  secure: true,
                  fetch_format: "auto",
                  quality: "auto",
                });

          ledger.migrated[obj.path] = {
            oldUrl: publicUrlOf(obj.path),
            newUrl,
            publicId: res.public_id,
            resourceType,
            bytes: obj.size,
            at: new Date().toISOString(),
          };
          ok++;
          console.log(`   ✅ ${obj.path}`);
        } catch (e) {
          failed++;
          console.error(`   ❌ ${obj.path} — ${e.message}`);
        }
      }),
    );
    if (!dryRun) saveLedger(ledger);
  }

  console.log(`\n   Médias : ${ok} migré(s), ${failed} en échec.`);

  // ── Réécriture des URL en base ────────────────────────────────────────────
  const map = Object.values(ledger.migrated);
  if (map.length === 0) {
    console.log("   Aucune URL à réécrire.\n");
    return;
  }

  console.log(`\n🔗 Réécriture des URL dans les tunnels…\n`);
  let updated = 0;

  for (const f of funnels) {
    let draft = JSON.stringify(f.json_content ?? null);
    let published = JSON.stringify(f.published_content ?? null);
    const before = draft + published;

    for (const entry of map) {
      if (draft) draft = draft.split(entry.oldUrl).join(entry.newUrl);
      if (published) published = published.split(entry.oldUrl).join(entry.newUrl);
    }

    if (draft + published === before) continue;

    if (dryRun) {
      console.log(`   [dry] tunnel ${f.id} serait mis à jour`);
      updated++;
      continue;
    }

    const { error } = await client
      .from("funnels")
      .update({
        json_content: draft ? JSON.parse(draft) : null,
        published_content: published ? JSON.parse(published) : null,
      })
      .eq("id", f.id);

    if (error) console.error(`   ❌ tunnel ${f.id} — ${error.message}`);
    else {
      updated++;
      console.log(`   ✅ tunnel ${f.id}`);
    }
  }

  console.log(`\n   ${updated} tunnel(s) mis à jour.`);
  console.log(`   Journal : ${LEDGER}\n`);
  console.log("   ⚠️  RIEN n'a été supprimé de Supabase.");
  console.log("   Vérifie tes tunnels publiés, puis lance la purge.\n");
}

// ── Commande : purge ────────────────────────────────────────────────────────
async function cmdPurge({ confirm }) {
  if (!confirm) {
    console.error("\n⚠️  Suppression IRRÉVERSIBLE.");
    console.error("   Relance avec --confirm une fois tes tunnels vérifiés :");
    console.error("   node scripts/migrate-media.mjs purge --confirm\n");
    process.exit(1);
  }

  const client = sb();
  const ledger = loadLedger();
  const paths = Object.keys(ledger.migrated);

  if (paths.length === 0) {
    console.error("\n❌ Journal vide : rien n'a été migré, donc rien à purger.\n");
    process.exit(1);
  }

  // 🔒 GARDE-FOU. On ne supprime QUE ce qui figure au journal comme migré, et
  // dont l'URL Cloudinary répond réellement. Un fichier absent du journal n'est
  // jamais touché — c'est ce qui empêche d'effacer un média non migré.
  console.log(`\n🗑️  Vérification de ${paths.length} fichier(s) avant suppression…\n`);

  const safe = [];
  for (const p of paths) {
    const entry = ledger.migrated[p];
    try {
      const res = await fetch(entry.newUrl, { method: "HEAD" });
      if (res.ok) safe.push(p);
      else console.warn(`   ⚠️  ignoré (Cloudinary HTTP ${res.status}) : ${p}`);
    } catch {
      console.warn(`   ⚠️  ignoré (Cloudinary injoignable) : ${p}`);
    }
  }

  console.log(`\n   ${safe.length}/${paths.length} confirmé(s) présents chez Cloudinary.`);
  if (safe.length === 0) {
    console.error("   Aucune suppression effectuée.\n");
    process.exit(1);
  }

  let removed = 0;
  for (let i = 0; i < safe.length; i += 100) {
    const chunk = safe.slice(i, i + 100);
    const { error } = await client.storage.from(BUCKET).remove(chunk);
    if (error) console.error(`   ❌ ${error.message}`);
    else removed += chunk.length;
  }

  console.log(`\n   ✅ ${removed} fichier(s) supprimés de Supabase Storage.\n`);
}

// ── Entrée ──────────────────────────────────────────────────────────────────
const [, , command, ...rest] = process.argv;
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const limitArg = rest.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : null;

requireEnv();

const run = {
  plan: () => cmdPlan(),
  migrate: () => cmdMigrate({ dryRun: flags.has("--dry-run"), limit }),
  purge: () => cmdPurge({ confirm: flags.has("--confirm") }),
}[command];

if (!run) {
  console.error(`
Usage :
  node --env-file=.env.local scripts/migrate-media.mjs plan
  node --env-file=.env.local scripts/migrate-media.mjs migrate [--dry-run] [--limit=50]
  node --env-file=.env.local scripts/migrate-media.mjs purge --confirm
`);
  process.exit(1);
}

run().catch((e) => {
  console.error(`\n💥 ${e.message}\n`);
  process.exit(1);
});
