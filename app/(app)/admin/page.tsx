// app/(app)/admin/page.tsx
// 🆕 MODULE 4 — Dashboard admin. Page strictement protégée : voir
// `requireAdminPage` (lib/admin/auth.ts) — un utilisateur non-admin est
// redirigé côté SERVEUR avant tout rendu, jamais un simple masquage client.
//
// 🆕 Deux onglets horizontaux : « Utilisateurs » (interface existante,
// inchangée) et « Clés API » (consommation et solde par fournisseur).
import { AppShell } from "@/components/dashboard/AppShell";
import { requireAdminPage } from "@/lib/admin/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { listAdminUsers } from "@/lib/admin/users";
import { AdminUsersTable } from "@/components/admin/AdminUsersTable";
import { AdminTabs } from "@/components/admin/AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdminPage(); // 🔒 redirige les non-admins — ne rien faire d'autre avant cet appel.

  const { tab } = await searchParams;
  const initialTab = tab === "keys" ? "keys" : "users";

  const admin = getSupabaseAdmin();
  const { users, total } = await listAdminUsers(admin, { limit: 50, offset: 0 });

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-black text-ink">Administration</h1>
        <p className="mt-2 text-sm text-muted">
          {total} compte{total > 1 ? "s" : ""} sur la plateforme. Réservé aux administrateurs.
        </p>
      </div>

      <AdminTabs
        initialTab={initialTab}
        usersPanel={<AdminUsersTable initialUsers={users} initialTotal={total} />}
      />
    </AppShell>
  );
}
