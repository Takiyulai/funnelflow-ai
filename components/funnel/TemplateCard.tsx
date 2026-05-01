import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { FunnelTemplate } from "@/lib/funnels/types";

export function TemplateCard({ template }: { template: FunnelTemplate }) {
  return (
    <Card 
      className="p-5 border-0 card-hover" 
      style={{ 
        background: "#0D1628", 
        border: "1px solid rgba(255,255,255,0.07)",
        transition: "transform 0.22s ease, box-shadow 0.22s ease"
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-lg font-black" style={{ color: "#fff" }}>{template.name}</h3>
        <Badge tone="gold">{template.badge}</Badge>
      </div>
      <p className="text-sm leading-6" style={{ color: "rgba(255,255,255,0.65)" }}>{template.objective}</p>
      <p className="mt-4 text-xs font-bold uppercase" style={{ color: "#31845C" }}>{template.sections.length} sections</p>
    </Card>
  );
}