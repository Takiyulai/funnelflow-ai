import { Copy, GripVertical, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Field";
import { demoFunnel } from "@/lib/funnels/demo";

export default function EditorPage() {
  return (
    <AppShell>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black text-ink">Éditeur de tunnel</h1>
          <p className="mt-2 text-sm text-muted">Modifiez, régénérez, déplacez, dupliquez ou supprimez chaque section.</p>
        </div>
        <Button href="/funnels/demo">Prévisualiser</Button>
      </div>
      <div className="mt-8 grid gap-4">
        {demoFunnel.sections.map((section) => (
          <Card key={section.id} className="p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-xs font-bold uppercase text-green">{section.type}</p>
                <h2 className="mt-1 text-xl font-black">{section.headline}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" type="button"><RefreshCw size={16} />IA</Button>
                <Button variant="secondary" type="button"><GripVertical size={16} /></Button>
                <Button variant="secondary" type="button"><Copy size={16} /></Button>
                <Button variant="secondary" type="button"><Trash2 size={16} /></Button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Titre"><Textarea defaultValue={section.headline} /></Field>
              <Field label="Texte"><Textarea defaultValue={section.body ?? section.subheadline ?? ""} /></Field>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
