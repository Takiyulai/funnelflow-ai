import { Mail, MessageCircle } from "lucide-react";
import type { AdminChatbotLead } from "@/lib/admin/chatbotLeads";

const STATUS_LABELS: Record<AdminChatbotLead["status"], string> = {
  new: "Nouveau",
  contacted: "Contacté",
  converted: "Converti",
  ignored: "Ignoré",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Porto-Novo",
  }).format(new Date(value));
}

export function AdminChatbotLeadsTable({
  leads,
  total,
}: {
  leads: AdminChatbotLead[];
  total: number;
}) {
  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <MessageCircle className="mx-auto text-muted" size={30} />
        <p className="mt-3 font-bold text-ink">Aucun prospect chatbot pour le moment</p>
        <p className="mt-1 text-sm text-muted">
          Les personnes qui remplissent le formulaire de l’assistant apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <p className="font-black text-ink">Prospects capturés par l’assistant</p>
        <p className="mt-1 text-xs text-muted">
          {total} contact{total > 1 ? "s" : ""} avec consentement · les plus récents en premier
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3">Prénom</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Statut</th>
              <th className="px-5 py-3">Inscription</th>
              <th className="px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leads.map((lead) => (
              <tr key={lead.id} className="text-ink">
                <td className="px-5 py-3 font-semibold">{lead.first_name}</td>
                <td className="px-5 py-3">{lead.email}</td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                    {STATUS_LABELS[lead.status]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-muted">
                  {formatDate(lead.created_at)}
                </td>
                <td className="px-5 py-3">
                  <a
                    href={`mailto:${encodeURIComponent(lead.email)}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#08498D] hover:underline"
                  >
                    <Mail size={14} /> Contacter
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
