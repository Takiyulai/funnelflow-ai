"use client";

// components/crm/EmailsModule.tsx
//
// 🆕 Module Email unifié : une seule entrée « Emails » à DEUX onglets.
//  - Newsletter / Diffusions : l'existant (CampaignsClient, envoi Resend).
//  - Séquences : automations temporisées générées par IA (ÉTAPE 4 — à venir).
//
// On ne casse RIEN de l'envoi Resend : l'onglet Newsletter rend exactement le
// composant Campagnes actuel, migré tel quel.

import { useState } from "react";
import { Mail, Workflow } from "lucide-react";
import { CampaignsClient } from "@/components/crm/CampaignsClient";
import { SequencesClient } from "@/components/crm/SequencesClient";
import type { Campaign } from "@/lib/crm/types";

type Tab = "newsletter" | "sequences";

export type PublishedFunnelOption = { id: string; name: string };

export function EmailsModule({
  initialCampaigns,
  contactsCount,
  resendReady,
  initialTab = "newsletter",
  publishedFunnels = [],
  campaignStats = {},
  tags = [],
}: {
  initialCampaigns: Campaign[];
  contactsCount: number;
  resendReady: boolean;
  initialTab?: Tab;
  publishedFunnels?: PublishedFunnelOption[];
  /** 🆕 LOT 3 — Ouvertures/clics par campagne (messages distincts). */
  campaignStats?: Record<string, { opens: number; clicks: number }>;
  /** 🆕 Tags CRM, pour le ciblage d'audience par tag dans les campagnes. */
  tags?: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabBtn = (value: Tab, label: string, Icon: typeof Mail) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
        tab === value
          ? "bg-ink text-white"
          : "text-muted hover:bg-black/5 hover:text-ink"
      }`}
    >
      <Icon size={15} />
      {label}
    </button>
  );

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-black text-ink">Emails</h1>
        <p className="mt-1 text-sm text-muted">
          Vos diffusions ponctuelles (newsletters) et vos séquences automatisées.
        </p>
      </div>

      <div className="inline-flex w-fit gap-1 rounded-xl border border-line/60 bg-white/50 p-1">
        {tabBtn("newsletter", "Newsletter / Diffusions", Mail)}
        {tabBtn("sequences", "Séquences", Workflow)}
      </div>

      {/* 🆕 On garde les DEUX onglets montés (masqués en CSS) pour ne pas perdre
          l'état (ex. séquence générée non encore enregistrée) au changement d'onglet. */}
      <div className={tab === "newsletter" ? "" : "hidden"}>
        <CampaignsClient
          initialCampaigns={initialCampaigns}
          contactsCount={contactsCount}
          resendReady={resendReady}
          campaignStats={campaignStats}
          tags={tags}
        />
      </div>
      <div className={tab === "sequences" ? "" : "hidden"}>
        <SequencesClient publishedFunnels={publishedFunnels} />
      </div>
    </div>
  );
}
