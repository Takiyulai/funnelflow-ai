// lib/chatbot/knowledge.ts
//
// 🆕 CHATBOT IA — Chargement de la base de connaissances (SERVEUR UNIQUEMENT).
//
// Lit et concatène tous les fichiers `.md` de `lib/chatbot/knowledge/`. Ces
// fichiers ne doivent JAMAIS être exposés au navigateur : `import "server-only"`
// garantit une erreur de build si ce module est importé côté client.
//
// Architecture / évolutivité : aujourd'hui on injecte TOUTE la doc dans le
// system prompt (simple, suffisant tant que la doc reste courte). La doc est
// déjà découpée par thème pour permettre plus tard un RAG (embeddings Supabase
// pgvector) sans réécrire l'appelant : il suffira de remplacer `loadKnowledgeBase`
// par une recherche sémantique renvoyant les extraits pertinents.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

const KNOWLEDGE_DIR = path.join(process.cwd(), "lib", "chatbot", "knowledge");

// Ordre de préférence d'affichage dans le prompt (sinon ordre alphabétique).
const PREFERRED_ORDER = [
  "demarrage.md",
  "fonctionnalites.md",
  "tarifs.md",
  "paiement.md",
  "faq.md",
];

// Cache mémoire : la doc change rarement (à chaque déploiement). On la lit une
// seule fois par instance serverless. `null` = pas encore chargée.
let cached: string | null = null;

/** Titre lisible dérivé du nom de fichier (ex. "faq.md" → "FAQ"). */
function sectionTitle(fileName: string): string {
  const base = fileName.replace(/\.md$/i, "");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Lit et concatène tous les `.md` de la base de connaissances en un seul bloc
 * de texte, prêt à être injecté dans le system prompt. Best-effort : un fichier
 * illisible est ignoré (ne casse pas la réponse du chatbot).
 */
export async function loadKnowledgeBase(): Promise<string> {
  if (cached !== null) return cached;

  try {
    const entries = await fs.readdir(KNOWLEDGE_DIR);
    const mdFiles = entries.filter((f) => f.toLowerCase().endsWith(".md"));

    // Tri : fichiers connus dans l'ordre préféré, puis le reste en alphabétique.
    mdFiles.sort((a, b) => {
      const ia = PREFERRED_ORDER.indexOf(a);
      const ib = PREFERRED_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    const parts: string[] = [];
    for (const file of mdFiles) {
      try {
        const content = (await fs.readFile(path.join(KNOWLEDGE_DIR, file), "utf8")).trim();
        if (content) {
          parts.push(`## Document : ${sectionTitle(file)}\n\n${content}`);
        }
      } catch {
        // Fichier illisible : on l'ignore.
      }
    }

    cached = parts.join("\n\n---\n\n");
  } catch {
    // Dossier introuvable (ex. non déployé) : base vide → le chatbot répondra
    // qu'il n'a pas l'information (garde-fou anti-hallucination).
    cached = "";
  }

  return cached;
}

/** Vide le cache (utile en développement / tests si la doc change). */
export function clearKnowledgeCache(): void {
  cached = null;
}
