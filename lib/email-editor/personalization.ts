export type EmailPersonalizationField = {
  key: string;
  label: string;
  token: string;
  source: "standard" | "custom";
};

export const DEFAULT_EMAIL_PERSONALIZATION_FIELDS: EmailPersonalizationField[] = [
  { key: "prenom", label: "Prénom", token: "{{prenom}}", source: "standard" },
  { key: "nom", label: "Nom complet", token: "{{nom}}", source: "standard" },
  { key: "email", label: "Adresse email", token: "{{email}}", source: "standard" },
  { key: "telephone", label: "Téléphone", token: "{{telephone}}", source: "standard" },
];

export function customFieldsToPersonalization(
  fields: Array<{ field_key: string; label: string }>,
): EmailPersonalizationField[] {
  return fields
    .filter((field) => /^[a-z][a-z0-9_]{0,49}$/i.test(field.field_key))
    .map((field) => ({
      key: field.field_key,
      label: field.label,
      token: `{{${field.field_key}}}`,
      source: "custom" as const,
    }));
}
