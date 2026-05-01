import { createDemoFunnel } from "@/lib/ai/generate";

export const demoFunnel = createDemoFunnel({
  brandName: "FunnelFlow AI",
  offerName: "Ebook premium conversion",
  price: "49€",
  targetAudience: "entrepreneurs, coaches et freelances",
  mainPain: "leur offre est utile mais leur page ne crée pas assez de confiance",
  promise: "créer une page claire, premium et prête à vendre",
  tone: "premium",
  funnelType: "Tunnel vente ebook premium",
  designStyle: "premium",
  language: "fr"
});
