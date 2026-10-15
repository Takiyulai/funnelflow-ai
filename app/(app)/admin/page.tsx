// app/(app)/admin/page.tsx
// 🆕 MODULE 4 — Dashboard admin. Page strictement protégée : voir
// `requireAdminPage` (lib/admin/auth.ts) — un utilisateur non-admin est
// redirigé côté SERVEUR avant tout rendu, jamais un simple masquage client.
//
// Trois onglets : utilisateurs, prospects capturés par le chatbot et clés API.
import { AppShell } from "@/components/dashboard/AppShell";
import { requireAdminPage } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { listAdminUsers } from "@/lib/admin/users";
import { AdminUsersTable } from "@/components/admin/AdminUsersTable";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAdminChatbotLeads } from "@/lib/admin/chatbotLeads";
import { AdminChatbotLeadsTable } from "@/components/admin/AdminChatbotLeadsTable";
import type { AdminTabId } from "@/components/admin/AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdminPage(); // 🔒 redirige les non-admins — ne rien faire d'autre avant cet appel.

  const { tab } = await searchParams;
  const initialTab: AdminTabId =
    tab === "keys" || tab === "chatbot-leads" ? tab : "users";

  const admin = getSupabaseAdmin();
  const [{ users, total }, chatbotLeads] = await Promise.all([
    listAdminUsers(admin, { limit: 50, offset: 0 }),
    listAdminChatbotLeads(admin),
  ]);

  return (
    <AppShell>
      <PageHeader
        title="Administration"
        subtitle={`${total} compte${total > 1 ? "s" : ""} sur la plateforme. Réservé aux administrateurs.`}
      />

      <AdminTabs
        initialTab={initialTab}
        usersPanel={<AdminUsersTable initialUsers={users} initialTotal={total} />}
        chatbotLeadsPanel={
          <AdminChatbotLeadsTable
            leads={chatbotLeads.leads}
            total={chatbotLeads.total}
          />
        }
      />
    </AppShell>
  );
}
