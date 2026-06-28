// app/(dashboard)/create/page.tsx
import { AppShell } from "@/components/dashboard/AppShell";
import { CreateFunnelWizard } from "@/components/funnel/CreateFunnelWizard";

export default function CreatePage() {
  return (
    <AppShell>
      {/* 🆕 Contenu centré (en-tête + wizard) avec une largeur max confortable. */}
      <div className="mx-auto w-full max-w-5xl">
        <div className="text-center">
          <h1 className="text-3xl font-black text-ink">Création de tunnel</h1>
          <p className="mt-2 text-sm text-muted">
            Renseignez les étapes, définissez vos CTA et vos visuels, puis générez un tunnel complet prêt à modifier
          </p>
        </div>
        <div className="mt-8 min-w-0 max-w-full">
          <CreateFunnelWizard />
        </div>
      </div>
    </AppShell>
  );
}
