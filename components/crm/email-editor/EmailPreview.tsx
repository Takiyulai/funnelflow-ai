"use client";

import { useState } from "react";
import { Monitor, Smartphone, X } from "lucide-react";

export function EmailPreview({ html, onClose }: { html: string; onClose: () => void }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#080e1a]/95 p-3 sm:p-6">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 pb-4 text-white">
        <div>
          <h2 className="text-lg font-black">Aperçu de l’email</h2>
          <p className="text-xs text-white/60">Le HTML affiché est celui utilisé lors de l’envoi.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-white/15 bg-white/5 p-1">
            <button type="button" onClick={() => setDevice("desktop")} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${device === "desktop" ? "bg-white text-[#080e1a]" : "text-white/70"}`}><Monitor size={15} /> Desktop</button>
            <button type="button" onClick={() => setDevice("mobile")} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${device === "mobile" ? "bg-white text-[#080e1a]" : "text-white/70"}`}><Smartphone size={15} /> Mobile</button>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-xl border border-white/15 p-2.5 text-white hover:bg-white/10"><X size={18} /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl bg-[#cfd5dd] p-3 sm:p-8">
        <iframe
          title="Aperçu email"
          sandbox=""
          srcDoc={html}
          className="mx-auto block h-full min-h-[640px] rounded-xl border-0 bg-white shadow-2xl transition-[width]"
          style={{ width: device === "mobile" ? 390 : "100%", maxWidth: device === "mobile" ? "100%" : 900 }}
        />
      </div>
    </div>
  );
}
