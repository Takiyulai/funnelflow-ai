"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRY_OPTIONS, flagUrl } from "@/lib/crm/phone";

type Props = {
  value: string;
  onChange: (iso: string) => void;
  /** Classe appliquée au bouton déclencheur (pour s'aligner sur le form). */
  className?: string;
};

/**
 * 🆕 Sélecteur d'indicatif téléphonique avec VRAIS drapeaux (images flagcdn).
 *
 * Un <select> natif ne peut afficher que du texte : les emoji drapeaux ne
 * s'affichent pas sous Windows/Chrome (« BJ » au lieu de 🇧🇯). On utilise donc
 * un dropdown custom avec des <img> de drapeaux.
 */
export function CountrySelect({ value, onChange, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current =
    COUNTRY_OPTIONS.find((c) => c.iso === value) ?? COUNTRY_OPTIONS[0];

  // Fermeture au clic extérieur + touche Échap.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-2 text-sm focus:outline-none focus:border-[#08498D] ${className}`}
      >
        {flagUrl(current.iso) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={flagUrl(current.iso) ?? ""}
            alt=""
            width={20}
            height={14}
            className="h-[14px] w-[20px] shrink-0 rounded-[2px] object-cover"
          />
        )}
        <span className="whitespace-nowrap">+{current.dial}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-64 w-60 overflow-auto rounded-lg border border-line bg-white py-1 shadow-xl"
        >
          {COUNTRY_OPTIONS.map((c) => {
            const url = flagUrl(c.iso);
            const active = c.iso === value;
            return (
              <li key={c.iso} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(c.iso);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-[#F8F9FB] ${
                    active ? "bg-[#F2F6FC] font-semibold" : ""
                  }`}
                >
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt=""
                      width={20}
                      height={14}
                      className="h-[14px] w-[20px] shrink-0 rounded-[2px] object-cover"
                    />
                  )}
                  <span className="flex-1 truncate text-ink">{c.label}</span>
                  <span className="text-muted">+{c.dial}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
