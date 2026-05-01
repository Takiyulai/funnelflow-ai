import { Bell, Clock, Mail, Tag, UserCheck, Zap } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Button } from "@/components/ui/Button";
import { WorkflowNode } from "@/components/workflows/WorkflowNode";

const nodes = [
  { title: "Nouveau lead", label: "Trigger", icon: Zap },
  { title: "Envoyer email", label: "Action", icon: Mail },
  { title: "Attendre 24 heures", label: "Action", icon: Clock },
  { title: "Ajouter statut CRM", label: "Action", icon: UserCheck },
  { title: "Ajouter tag", label: "Action", icon: Tag },
  { title: "Notification interne", label: "Action", icon: Bell }
];

export default function WorkflowsPage() {
  return (
    <AppShell>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black text-ink">Workflows simples</h1>
          <p className="mt-2 text-sm text-muted">Un parcours lisible en blocs, pensé pour les automatisations V1.</p>
        </div>
        <Button>Créer un workflow</Button>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {nodes.map(({ title, label, icon: Icon }) => {
          return <WorkflowNode key={title} title={title} label={label} icon={<Icon size={20} />} />;
        })}
      </div>
      <div className="mt-8 rounded-lg border border-line bg-white p-5">
        <div className="grid gap-4 md:grid-cols-4">
          {["Formulaire rempli", "Email envoyé", "Attendre X jours", "Statut qualifié"].map((item, index) => (
            <div key={item} className="rounded-lg bg-canvas p-4 text-sm font-black text-ink">
              <span className="mb-2 grid h-7 w-7 place-items-center rounded-full bg-gold text-xs text-navy">{index + 1}</span>
              {item}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
