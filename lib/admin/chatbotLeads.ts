import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminChatbotLead = {
  id: string;
  first_name: string;
  email: string;
  status: "new" | "contacted" | "converted" | "ignored";
  source: string;
  consent_at: string;
  last_seen_at: string;
  created_at: string;
};

export async function listAdminChatbotLeads(
  admin: SupabaseClient,
  limit = 200,
): Promise<{ leads: AdminChatbotLead[]; total: number }> {
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const { data, error, count } = await admin
    .from("chatbot_leads")
    .select(
      "id, first_name, email, status, source, consent_at, last_seen_at, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message);
  const leads = (data ?? []) as AdminChatbotLead[];
  return { leads, total: count ?? leads.length };
}
