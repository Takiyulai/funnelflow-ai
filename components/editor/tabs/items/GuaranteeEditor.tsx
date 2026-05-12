"use client";

import type { FunnelSection, SectionItem, GuaranteeItem } from "@/lib/funnels/types";
import { IconPicker } from "../../IconPicker";

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
};

export function GuaranteeEditor({ section, onChange }: Props) {
  // Une seule garantie par section : on prend le premier item ou on en crée un
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "guarantee" } => it.kind === "guarantee"
  );

  const item = items[0];
  const data: GuaranteeItem = item?.data || {
    title: "",
    duration: "",
    description: "",
    iconName: "shield",
  };

  const updateData = (patch: Partial<GuaranteeItem>) => {
    const newData = { ...data, ...patch };
    const newItem: SectionItem = { kind: "guarantee", data: newData };
    onChange({ items: [newItem] });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-white/10 bg-zinc-950/60 p-3">
        <p className="mb-3 text-[11px] text-white/50">
          Une seule garantie par section. Pour proposer plusieurs garanties, créez plusieurs sections.
        </p>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-white/60">
                Titre
              </label>
              <input
                type="text"
                value={data.title}
                onChange={(e) => updateData({ title: e.target.value })}
                placeholder="Satisfait ou remboursé"
                className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-white/60">
                Durée
              </label>
              <input
                type="text"
                value={data.duration || ""}
                onChange={(e) => updateData({ duration: e.target.value })}
                placeholder="30 jours"
                className="w-full rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/60">
              Description
            </label>
            <textarea
              value={data.description || ""}
              onChange={(e) => updateData({ description: e.target.value })}
              placeholder="Si vous n'êtes pas satisfait, nous vous remboursons intégralement…"
              rows={3}
              className="w-full resize-y rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/60">
              Icône
            </label>
            <IconPicker
              value={data.iconName || "shield"}
              onChange={(iconName) => updateData({ iconName })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
