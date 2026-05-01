export type Language = "fr" | "en";

export type FunnelSectionType =
  | "hero"
  | "problem"
  | "solution"
  | "benefits"
  | "proof"
  | "offer"
  | "bonus"
  | "guarantee"
  | "faq"
  | "cta"
  | "form"
  | "thank_you"
  | "program"
  | "pricing"
  | "process"
  | "webinar"
  | "qualification";

export type FunnelSection = {
  id: string;
  type: FunnelSectionType;
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  body?: string;
  bullets?: string[];
  cta?: string;
  visualDirection?: string;
};

export type EmailSequenceItem = {
  subject: string;
  html: string;
  text: string;
  cta: string;
};

export type Funnel = {
  funnelName: string;
  language: Language;
  sections: FunnelSection[];
  thankYouPage: {
    headline: string;
    body: string;
    cta?: string;
  };
  emails: EmailSequenceItem[];
  seo: {
    title: string;
    description: string;
  };
  design: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    style: string;
  };
};

export type FunnelBrief = {
  brandName: string;
  offerName: string;
  price: string;
  targetAudience: string;
  mainPain: string;
  promise: string;
  tone: string;
  funnelType: string;
  designStyle: string;
  language: Language;
};

export type FunnelTemplate = {
  id: string;
  name: string;
  objective: string;
  audience: string;
  sections: FunnelSectionType[];
  badge: string;
};
