"use client";

import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";
import { isEmailRichTextEmpty, sanitizeEmailRichHtml } from "@/lib/email-editor/compiler";
import type { EmailBlock, EmailDocument } from "@/lib/email-editor/types";

function BlockContent({ block }: { block: EmailBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <div
          style={{
            color: block.style.color,
            fontSize: block.style.fontSize,
            lineHeight: block.style.lineHeight,
            textAlign: block.style.align,
            padding: block.style.padding,
            fontWeight: 700,
          }}
        >
          {block.content.text || "Titre vide"}
        </div>
      );
    case "richText":
      return isEmailRichTextEmpty(block.content.html) ? (
        <div
          className="text-sm italic text-[#7b8494]"
          style={{ padding: block.style.padding }}
        >
          Écrivez votre message ici…
        </div>
      ) : (
        <div
          style={{
            color: block.style.color,
            fontSize: block.style.fontSize,
            lineHeight: block.style.lineHeight,
            textAlign: block.style.align,
            padding: block.style.padding,
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeEmailRichHtml(block.content.html) }}
        />
      );
    case "image":
      return (
        <div style={{ padding: block.style.padding, textAlign: block.style.align }}>
          {block.content.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.content.src}
              alt={block.content.alt}
              style={{
                display: "inline-block",
                width: `${block.style.width}%`,
                maxWidth: "100%",
                borderRadius: block.style.borderRadius,
              }}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-canvas px-4 py-12 text-center text-sm text-muted">
              Sélectionne ce bloc pour ajouter une image
            </div>
          )}
        </div>
      );
    case "button":
      return (
        <div style={{ padding: block.style.padding, textAlign: block.style.align }}>
          <span
            style={{
              display: "inline-block",
              background: block.style.background,
              color: block.style.color,
              borderRadius: block.style.borderRadius,
              fontSize: block.style.fontSize,
              fontWeight: 700,
              padding: "14px 26px",
            }}
          >
            {block.content.text || "Bouton"}
          </span>
        </div>
      );
    case "divider":
      return (
        <div style={{ padding: block.style.padding }}>
          <div
            style={{
              width: `${block.style.width}%`,
              margin: "0 auto",
              borderTop: `${block.style.thickness}px solid ${block.style.color}`,
            }}
          />
        </div>
      );
    case "spacer":
      return <div style={{ height: block.style.height }} />;
  }
}

export function EmailCanvas({
  document,
  selectedId,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: {
  document: EmailDocument;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId) return;
    const frame = window.requestAnimationFrame(() => {
      const target = scrollAreaRef.current?.querySelector<HTMLElement>(
        `[data-email-block-id="${CSS.escape(selectedId)}"]`,
      );
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId]);

  return (
    <div
      ref={scrollAreaRef}
      className="h-full min-h-0 overflow-y-auto overscroll-contain bg-[#dfe3e9] p-4 pb-28 sm:p-8 sm:pb-28"
      onClick={() => undefined}
    >
      <div
        className="mx-auto min-h-[520px] overflow-hidden rounded-2xl shadow-[0_18px_60px_rgba(8,14,26,0.16)]"
        style={{
          width: "100%",
          maxWidth: document.settings.width,
          background: document.settings.contentBackground,
          fontFamily: document.settings.fontFamily,
        }}
      >
        <div className="h-1.5 bg-[color:var(--ff-accent)]" />
        {document.blocks.length === 0 ? (
          <div className="grid min-h-[500px] place-items-center px-8 text-center">
            <div>
              <div className="text-lg font-black text-[#080e1a]">Ton email est vide</div>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#687386]">
                Ajoute un titre, un texte, une image ou un bouton depuis la palette.
              </p>
            </div>
          </div>
        ) : (
          document.blocks.map((block, index) => {
            const selected = block.id === selectedId;
            return (
              <div
                key={block.id}
                data-email-block-id={block.id}
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(block.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSelect(block.id);
                }}
                className={`group relative cursor-pointer outline-none transition ${
                  selected
                    ? "ring-2 ring-inset ring-[color:var(--ff-accent)]"
                    : "hover:ring-1 hover:ring-inset hover:ring-[#8ea0b8]"
                }`}
              >
                {selected && (
                  <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-line bg-surface p-1 shadow-lg">
                    <button type="button" aria-label="Monter" disabled={index === 0} onClick={(event) => { event.stopPropagation(); onMove(block.id, -1); }} className="rounded p-1 text-muted hover:bg-canvas disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button type="button" aria-label="Descendre" disabled={index === document.blocks.length - 1} onClick={(event) => { event.stopPropagation(); onMove(block.id, 1); }} className="rounded p-1 text-muted hover:bg-canvas disabled:opacity-30"><ArrowDown size={14} /></button>
                    <button type="button" aria-label="Dupliquer" onClick={(event) => { event.stopPropagation(); onDuplicate(block.id); }} className="rounded p-1 text-muted hover:bg-canvas"><Copy size={14} /></button>
                    <button type="button" aria-label="Supprimer" onClick={(event) => { event.stopPropagation(); onDelete(block.id); }} className="rounded p-1 text-red-500 hover:bg-red-500/10"><Trash2 size={14} /></button>
                  </div>
                )}
                <BlockContent block={block} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
