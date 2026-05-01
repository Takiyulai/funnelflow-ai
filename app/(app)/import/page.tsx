import { Upload } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";

export default function ImportPage() {
  return (
    <AppShell>
      <h1 className="text-3xl font-black text-ink">Importer une inspiration</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
        Collez une URL pour analyser la structure, les angles marketing, les CTA et la hiérarchie visuelle. Les textes, images et branding ne sont pas copiés.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <Card className="p-5">
          <form className="grid gap-4">
            <Field label="URL d’inspiration"><Input placeholder="https://exemple.com/page" /></Field>
            <Field label="Votre offre"><Textarea placeholder="Décrivez l’offre à adapter..." /></Field>
            <Button type="button"><Upload size={18} />Analyser</Button>
          </form>
        </Card>
        <Card className="p-5">
          <h2 className="text-xl font-black">Analyse prévue</h2>
          <div className="mt-4 grid gap-3 text-sm text-muted">
            {["Structure des sections", "Type d’offre", "Angles marketing", "CTA", "Hiérarchie visuelle", "Nouveau copywriting original"].map((item) => (
              <div key={item} className="rounded-lg border border-line p-3">{item}</div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
