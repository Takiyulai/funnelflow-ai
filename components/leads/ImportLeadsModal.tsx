// components/leads/ImportLeadsModal.tsx
// 🆕 MODULE 3 — Import CSV/Excel de leads : upload → mapping des colonnes (avec
// prévisualisation) → confirmation → rapport (importés/doublons/erreurs).
"use client";

import { useState } from "react";
import { X, Upload, Plus, Loader2, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TargetField } from "@/lib/import/leadsImport";
import type { ContactListWithCount, LeadStatus } from "@/lib/crm/types";

type CustomFieldOption = { id: string; field_key: string; label: string };

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "nouveau", label: "Nouveau" },
  { value: "contacte", label: "Contacté" },
  { value: "qualifie", label: "Qualifié" },
  { value: "client", label: "Client" },
  { value: "perdu", label: "Perdu" },
];

type ParseResponse = {
  ok: true;
  headers: string[];
  rows: string[][];
  totalRows: number;
  truncated: boolean;
  suggestedMapping: TargetField[];
  fixedTargetFields: { key: string; label: string; required?: boolean }[];
  customFields: CustomFieldOption[];
  /** 🆕 Listes existantes + nom de lot suggéré (dérivé du nom de fichier). */
  lists: ContactListWithCount[];
  suggestedListName: string;
};

type CommitResponse = {
  ok: true;
  imported: number;
  duplicates: number;
  errors: string[];
  totalErrors: number;
  totalRows: number;
  listId: string | null;
  listName: string | null;
};

type Step = "pick" | "mapping" | "result";

export function ImportLeadsModal({
  funnels = [],
  onClose,
  onImported,
}: {
  funnels?: { id: string; name: string }[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [mapping, setMapping] = useState<TargetField[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldOption[]>([]);
  const [dedupeOn, setDedupeOn] = useState<"email" | "phone">("email");
  const [funnelId, setFunnelId] = useState("");
  const [newFieldFor, setNewFieldFor] = useState<number | null>(null);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [result, setResult] = useState<CommitResponse | null>(null);

  // 🆕 Classement du lot importé. `listChoice` vaut "__new__" (créer une
  // nouvelle liste, cas par défaut) ou l'id d'une liste existante.
  const [lists, setLists] = useState<ContactListWithCount[]>([]);
  const [listChoice, setListChoice] = useState<string>("__new__");
  const [listName, setListName] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [defaultStatus, setDefaultStatus] = useState<LeadStatus>("nouveau");

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/leads/import/parse", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as ParseResponse & { error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error || "Impossible de lire ce fichier.");
        return;
      }
      setParsed(json);
      setMapping(json.suggestedMapping);
      setCustomFields(json.customFields);
      setLists(json.lists ?? []);
      setListName(json.suggestedListName ?? "");
      setStep("mapping");
    } catch {
      setError("Erreur réseau pendant la lecture du fichier.");
    } finally {
      setBusy(false);
    }
  }

  function setColumnMapping(colIdx: number, value: string) {
    setMapping((cur) => {
      const next = [...cur];
      next[colIdx] = value;
      return next;
    });
  }

  async function createFieldForColumn(colIdx: number) {
    const label = newFieldLabel.trim();
    if (!label) return;
    setBusy(true);
    try {
      const res = await fetch("/api/crm/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        alert(json.error === "field_already_exists" ? "Ce champ existe déjà." : "Création impossible.");
        return;
      }
      setCustomFields((cur) => [...cur, json.field]);
      setColumnMapping(colIdx, json.field.field_key);
      setNewFieldFor(null);
      setNewFieldLabel("");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers: parsed.headers,
          rows: parsed.rows,
          mapping,
          funnelId: funnelId || null,
          dedupeOn,
          // Une seule des deux clés est renseignée : liste existante OU
          // nouvelle liste par son nom. "__none__" = import non classé.
          listId: listChoice === "__new__" || listChoice === "__none__" ? null : listChoice,
          listName: listChoice === "__new__" ? listName.trim() : "",
          sourceLabel: sourceLabel.trim(),
          defaultStatus,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as CommitResponse & { error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error || "Import impossible.");
        return;
      }
      setResult(json);
      setStep("result");
      onImported();
    } catch {
      setError("Erreur réseau pendant l'import.");
    } finally {
      setBusy(false);
    }
  }

  const hasEmailMapping = mapping.includes("email");
  // Créer une liste sans lui donner de nom n'a pas de sens : on bloque plutôt
  // que d'inventer un nom à la place de l'utilisateur.
  const listReady = listChoice !== "__new__" || listName.trim().length > 0;
  const previewRows = parsed ? parsed.rows.slice(0, 8) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onClose()}>
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-ink">Importer des leads (CSV / Excel)</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink" disabled={busy}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red/30 bg-red/5 px-3 py-2 text-sm text-red">{error}</p>
        )}

        {step === "pick" && (
          <div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-canvas px-6 py-10 text-center hover:border-navy/40">
              <Upload className="h-8 w-8 text-muted" />
              <span className="text-sm font-semibold text-ink">
                {busy ? "Lecture du fichier…" : "Cliquez pour choisir un fichier .csv ou .xlsx"}
              </span>
              <span className="text-xs text-muted">15 Mo max, 20 000 lignes max</span>
              <input
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleFile(file);
                }}
              />
            </label>
            {busy && <Loader2 className="mx-auto mt-3 h-5 w-5 animate-spin text-muted" />}
          </div>
        )}

        {step === "mapping" && parsed && (
          <div className="grid gap-4">
            <p className="text-sm text-muted">
              {parsed.totalRows} ligne{parsed.totalRows > 1 ? "s" : ""} détectée
              {parsed.totalRows > 1 ? "s" : ""}
              {parsed.truncated ? " (seules les 20 000 premières seront importées)" : ""}. Associez chaque
              colonne à un champ.
            </p>

            {/* 🆕 CLASSEMENT DU LOT — placé AVANT le mapping des colonnes, et
                non après, parce que c'est la décision qui détermine si ces
                contacts seront retrouvables plus tard. Reléguée en bas de
                l'écran, elle serait systématiquement sautée. */}
            <div className="rounded-xl border border-accent bg-accent-soft p-4">
              <div className="flex items-start gap-2">
                <FolderPlus size={16} className="mt-0.5 shrink-0 text-accent-ink" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">Classer ces contacts</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Une liste regroupe les contacts d&apos;une même provenance.
                    Sans elle, ces {parsed.totalRows} lignes se mélangeront aux
                    leads capturés par tes tunnels, sans moyen de les isoler
                    ensuite.
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold uppercase text-muted">Liste</span>
                      <select
                        value={listChoice}
                        onChange={(e) => setListChoice(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                      >
                        <option value="__new__">+ Nouvelle liste…</option>
                        {lists.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.contactsCount})
                          </option>
                        ))}
                        <option value="__none__">Ne pas classer</option>
                      </select>
                    </label>

                    {listChoice === "__new__" && (
                      <label className="block">
                        <span className="text-xs font-bold uppercase text-muted">
                          Nom de la liste
                        </span>
                        <input
                          value={listName}
                          onChange={(e) => setListName(e.target.value)}
                          placeholder="Salon Cotonou — juillet"
                          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                        />
                      </label>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold uppercase text-muted">
                        Origine (optionnel)
                      </span>
                      <input
                        value={sourceLabel}
                        onChange={(e) => setSourceLabel(e.target.value)}
                        placeholder="salon-cotonou"
                        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                      />
                      <span className="mt-1 block text-[11px] text-muted">
                        Recopié dans le champ « source » de chaque contact.
                      </span>
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase text-muted">
                        Statut initial
                      </span>
                      <select
                        value={defaultStatus}
                        onChange={(e) => setDefaultStatus(e.target.value as LeadStatus)}
                        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <span className="mt-1 block text-[11px] text-muted">
                        Utilisé seulement si le fichier n&apos;a pas de colonne statut.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase text-muted">Déduplication sur</span>
                <select
                  value={dedupeOn}
                  onChange={(e) => setDedupeOn(e.target.value as "email" | "phone")}
                  className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink"
                >
                  <option value="email">Email</option>
                  <option value="phone">Téléphone</option>
                </select>
              </label>
              {funnels.length > 0 && (
                <label className="block">
                  <span className="text-xs font-bold uppercase text-muted">Tunnel associé (optionnel)</span>
                  <select
                    value={funnelId}
                    onChange={(e) => setFunnelId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink"
                  >
                    <option value="">Aucun</option>
                    {funnels.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-canvas text-left">
                    {parsed.headers.map((h, i) => (
                      <th key={i} className="min-w-[160px] px-3 py-2 align-top">
                        <div className="mb-1 font-bold text-ink">{h || `Colonne ${i + 1}`}</div>
                        <select
                          value={mapping[i] ?? "ignore"}
                          onChange={(e) => {
                            if (e.target.value === "__new__") {
                              setNewFieldFor(i);
                              return;
                            }
                            setColumnMapping(i, e.target.value);
                          }}
                          className="w-full rounded-md border border-line bg-white px-2 py-1 text-xs font-normal text-ink"
                        >
                          {parsed.fixedTargetFields.map((f) => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                          ))}
                          {customFields.map((f) => (
                            <option key={f.id} value={f.field_key}>{f.label} (perso.)</option>
                          ))}
                          <option value="__new__">+ Nouveau champ personnalisé…</option>
                        </select>
                        {newFieldFor === i && (
                          <div className="mt-1 flex gap-1">
                            <input
                              autoFocus
                              value={newFieldLabel}
                              onChange={(e) => setNewFieldLabel(e.target.value)}
                              placeholder="Nom du champ"
                              className="w-full rounded-md border border-line px-2 py-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => createFieldForColumn(i)}
                              disabled={!newFieldLabel.trim() || busy}
                              className="rounded-md bg-navy px-2 text-white disabled:opacity-50"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className="border-t border-line/60">
                      {parsed.headers.map((_, ci) => (
                        <td
                          key={ci}
                          className={`px-3 py-1.5 ${mapping[ci] === "ignore" ? "text-muted/50 line-through" : "text-ink"}`}
                        >
                          {row[ci] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!hasEmailMapping && (
              <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-medium text-ink">
                Associez au moins une colonne au champ « Email » (obligatoire) pour continuer.
              </p>
            )}
            {hasEmailMapping && !listReady && (
              <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-medium text-ink">
                Donnez un nom à la nouvelle liste, ou choisissez « Ne pas classer ».
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep("pick")} disabled={busy}>
                Retour
              </Button>
              <Button onClick={confirmImport} disabled={busy || !hasEmailMapping || !listReady}>
                {busy ? "Import en cours…" : `Importer ${parsed.totalRows} ligne${parsed.totalRows > 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="grid gap-4">
            {/* 🆕 On confirme explicitement OÙ les contacts ont atterri, avec
                un lien direct vers la liste filtrée : sans ça, l'utilisateur
                voit « 480 importés » et doit deviner où ils sont passés. */}
            {result.listId && result.listName && (
              <a
                href={`/leads?list=${result.listId}`}
                className="flex items-center gap-2 rounded-lg border border-accent bg-accent-soft px-3 py-2.5 text-sm text-ink transition hover:border-accent"
              >
                <FolderPlus size={15} className="shrink-0 text-accent-ink" />
                <span className="min-w-0">
                  Classés dans la liste{" "}
                  <strong>{result.listName}</strong> — voir ces contacts
                </span>
              </a>
            )}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-line bg-canvas p-4">
                <p className="text-2xl font-black text-ink">{result.imported}</p>
                <p className="text-xs text-muted">Importés</p>
              </div>
              <div className="rounded-lg border border-line bg-canvas p-4">
                <p className="text-2xl font-black text-ink">{result.duplicates}</p>
                <p className="text-xs text-muted">Doublons ignorés</p>
              </div>
              <div className="rounded-lg border border-line bg-canvas p-4">
                <p className="text-2xl font-black text-ink">{result.totalErrors}</p>
                <p className="text-xs text-muted">Erreurs</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-line bg-canvas p-3 text-xs text-muted">
                {result.errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={onClose}>Terminer</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportLeadsModal;
