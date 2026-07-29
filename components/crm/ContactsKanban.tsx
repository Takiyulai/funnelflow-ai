"use client";

// components/crm/ContactsKanban.tsx
//
// 🆕 MODULE 2 — Pipeline CRM en colonnes.
//
// MÊMES DONNÉES QUE LA LISTE, AUTRE LECTURE. Une colonne = un `leads.status`.
// Déplacer une carte écrit le nouveau statut via PATCH /api/crm/contacts/:id,
// exactement comme l'édition depuis la fiche — donc le déclencheur de workflow
// `status.changed` part aussi depuis ici. Un glisser-déposer peut ainsi lancer
// une séquence email, ce qui est précisément l'intérêt de ce mode de travail.
//
// POURQUOI PAS @dnd-kit/sortable. Trier les cartes À L'INTÉRIEUR d'une colonne
// suppose une position persistée ; la table `leads` n'a pas de colonne d'ordre.
// Un tri qui ne survivrait pas au rechargement serait un mensonge visuel. On
// s'en tient donc au déplacement ENTRE colonnes, et l'ordre reste
// l'antichronologique de la requête.
//
// ACCESSIBILITÉ. Le glisser-déposer n'est jamais le SEUL chemin : chaque carte
// porte un sélecteur de statut. C'est indispensable au clavier, et bien plus
// confortable au doigt sur mobile, où faire glisser une carte entre deux
// colonnes qui défilent horizontalement est pénible.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Eye, GripVertical, Loader2 } from "lucide-react";
import type { ContactWithTags, LeadStatus } from "@/lib/crm/types";

const COLUMNS: { id: LeadStatus; label: string; hint: string }[] = [
  { id: "nouveau", label: "Nouveau", hint: "Vient d'arriver, jamais contacté" },
  { id: "contacte", label: "Contacté", hint: "Premier message envoyé" },
  { id: "qualifie", label: "Qualifié", hint: "A un besoin réel et un budget" },
  { id: "client", label: "Client", hint: "A acheté" },
  { id: "perdu", label: "Perdu", hint: "Sans suite" },
];

const STATUS_LABEL: Record<LeadStatus, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  qualifie: "Qualifié",
  client: "Client",
  perdu: "Perdu",
};

// ─────────────────────────────────────────────────────────────────────────────

function Card({
  contact,
  onStatusChange,
  saving,
}: {
  contact: ContactWithTags;
  onStatusChange: (id: string, status: LeadStatus) => void;
  saving: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
  });

  // Translation appliquée à la main plutôt que via @dnd-kit/utilities : une
  // dépendance de moins pour une seule ligne de CSS.
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-line bg-surface p-2.5 shadow-sm transition ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <div className="flex items-start gap-1.5">
        {/* Poignée dédiée : rendre TOUTE la carte draggable empêcherait de
            cliquer le sélecteur et le lien de la fiche. */}
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none text-muted active:cursor-grabbing"
          aria-label={`Déplacer ${contact.name || contact.email}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical size={14} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {contact.name || contact.email}
          </p>
          {contact.name && (
            <p className="truncate text-[11px] text-muted">{contact.email}</p>
          )}

          {(contact.tags.length > 0 || (contact.lists ?? []).length > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(contact.lists ?? []).map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: `${l.color}22`, color: l.color }}
                >
                  {l.name}
                </span>
              ))}
              {contact.tags.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: `${t.color}22`, color: t.color }}
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted" />}
          <Link
            href={`/leads/${contact.id}`}
            title="Voir la fiche"
            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-canvas hover:text-ink"
          >
            <Eye size={12} />
          </Link>
        </div>
      </div>

      {/* Chemin ALTERNATIF au glisser-déposer (clavier, mobile). */}
      <select
        value={contact.status}
        onChange={(e) => onStatusChange(contact.id, e.target.value as LeadStatus)}
        aria-label={`Statut de ${contact.name || contact.email}`}
        className="mt-2 w-full rounded border border-line bg-canvas px-1.5 py-1 text-[11px] text-muted outline-none focus:border-accent"
      >
        {COLUMNS.map((c) => (
          <option key={c.id} value={c.id}>{c.label}</option>
        ))}
      </select>
    </div>
  );
}

function Column({
  column,
  contacts,
  onStatusChange,
  savingIds,
}: {
  column: (typeof COLUMNS)[number];
  contacts: ContactWithTags[];
  onStatusChange: (id: string, status: LeadStatus) => void;
  savingIds: string[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex min-w-[240px] flex-1 flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-ink">
          {column.label}
        </span>
        <span className="text-xs font-bold text-muted">{contacts.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex min-h-[160px] flex-1 flex-col gap-2 rounded-xl border p-2 transition ${
          isOver ? "border-accent bg-accent-soft" : "border-line bg-canvas"
        }`}
      >
        {contacts.length === 0 ? (
          <p className="px-1 py-6 text-center text-[11px] leading-relaxed text-muted">
            {column.hint}
          </p>
        ) : (
          contacts.map((c) => (
            <Card
              key={c.id}
              contact={c}
              onStatusChange={onStatusChange}
              saving={savingIds.includes(c.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function ContactsKanban({
  contacts: initial,
  onChanged,
}: {
  contacts: ContactWithTags[];
  /** Appelé après une écriture réussie, pour resynchroniser la page. */
  onChanged?: () => void;
}) {
  const [contacts, setContacts] = useState(initial);
  const [savingIds, setSavingIds] = useState<string[]>([]);

  // Resynchronisation avec le serveur — mais UNIQUEMENT quand la COMPOSITION
  // de la liste change (filtre modifié, contact créé ou supprimé).
  //
  // Se resynchroniser à chaque nouveau rendu écraserait les mises à jour
  // optimistes : après un déplacement, `router.refresh()` renvoie des props
  // qui peuvent encore porter l'ancien statut si la requête serveur est partie
  // avant l'écriture. La carte reviendrait alors visuellement en arrière avant
  // de repartir — un scintillement que l'utilisateur lit comme un bug.
  // La signature ne retient donc que les identifiants, pas les statuts.
  const idSignature = initial.map((c) => c.id).join(",");
  useEffect(() => {
    setContacts(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idSignature]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    // 6 px avant de considérer que c'est un glissement : sans cette distance,
    // un simple clic sur la poignée déclencherait un drag fantôme.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = useMemo(() => {
    const map: Record<LeadStatus, ContactWithTags[]> = {
      nouveau: [], contacte: [], qualifie: [], client: [], perdu: [],
    };
    for (const c of contacts) {
      // Un statut inconnu (donnée héritée, import bricolé) ne doit PAS faire
      // disparaître le contact du tableau : on le range en « Nouveau » plutôt
      // que de le perdre dans une colonne qui n'existe pas.
      const col = map[c.status] ? c.status : "nouveau";
      map[col].push(c);
    }
    return map;
  }, [contacts]);

  const dragged = draggingId ? contacts.find((c) => c.id === draggingId) ?? null : null;

  async function applyStatus(id: string, status: LeadStatus) {
    const before = contacts;
    const current = contacts.find((c) => c.id === id);
    if (!current || current.status === status) return;

    // Mise à jour OPTIMISTE : la carte doit atterrir immédiatement, sinon le
    // geste paraît cassé. En cas d'échec on restaure l'état précédent.
    setContacts((cur) => cur.map((c) => (c.id === id ? { ...c, status } : c)));
    setSavingIds((cur) => [...cur, id]);
    setError(null);

    try {
      const res = await fetch(`/api/crm/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setContacts(before);
        setError("Changement de statut impossible. L'affichage a été rétabli.");
        return;
      }
      onChanged?.();
    } catch {
      setContacts(before);
      setError("Réseau indisponible. L'affichage a été rétabli.");
    } finally {
      setSavingIds((cur) => cur.filter((x) => x !== id));
    }
  }

  function handleDragStart(e: DragStartEvent) {
    setDraggingId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const status = String(overId) as LeadStatus;
    if (!COLUMNS.some((c) => c.id === status)) return;
    applyStatus(String(e.active.id), status);
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-lg border border-danger bg-danger-soft px-3 py-2 text-xs text-danger-ink">
          {error}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        {/* Défilement horizontal sur petit écran : cinq colonnes ne tiennent
            pas sous 1024 px, et les compresser les rendrait illisibles. */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              column={col}
              contacts={byStatus[col.id] ?? []}
              onStatusChange={applyStatus}
              savingIds={savingIds}
            />
          ))}
        </div>

        {/* Aperçu qui suit le curseur : sans lui, la carte d'origine devient
            translucide et l'utilisateur ne voit plus ce qu'il déplace. */}
        <DragOverlay>
          {dragged ? (
            <div className="rounded-lg border border-accent bg-surface p-2.5 shadow-elevated">
              <p className="truncate text-sm font-semibold text-ink">
                {dragged.name || dragged.email}
              </p>
              <p className="truncate text-[11px] text-muted">
                {STATUS_LABEL[dragged.status]}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default ContactsKanban;
