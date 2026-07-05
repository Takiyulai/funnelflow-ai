// app/(dashboard)/create/page.tsx
import { AppShell } from "@/components/dashboard/AppShell";
import { CreateFunnelWizard } from "@/components/funnel/CreateFunnelWizard";

export default function CreatePage() {
  return (
    <AppShell>
      {/* 🆕 Contenu centré (en-tête + wizard) avec une largeur max confortable. */}
      <div className="mx-auto w-full max-w-5xl">
        <div className="text-center">
          <h1 className="text-3xl font-black text-ink">Créer ma machine de vente</h1>
          <p className="mt-2 text-sm text-muted">
            Décrivez votre offre : vos agents IA construisent tout — tunnel premium, copy, emails, CRM et automatisations, prêts à modifier
          </p>
        </div>
        <div className="mt-8 min-w-0 max-w-full">
          <CreateFunnelWizard />
        </div>
      </div>
    </AppShell>
  );
}
