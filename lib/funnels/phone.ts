import type { FormFieldItem } from "@/lib/funnels/types";

export const PHONE_DIAL_CODES = [
  { code: "+33", country: "France" },
  { code: "+32", country: "Belgique" },
  { code: "+41", country: "Suisse" },
  { code: "+1", country: "Canada / USA" },
  { code: "+237", country: "Cameroun" },
  { code: "+225", country: "Côte d’Ivoire" },
  { code: "+221", country: "Sénégal" },
  { code: "+223", country: "Mali" },
  { code: "+226", country: "Burkina Faso" },
  { code: "+229", country: "Bénin" },
  { code: "+228", country: "Togo" },
  { code: "+224", country: "Guinée" },
  { code: "+241", country: "Gabon" },
  { code: "+242", country: "Congo" },
  { code: "+243", country: "RDC" },
  { code: "+212", country: "Maroc" },
  { code: "+213", country: "Algérie" },
  { code: "+216", country: "Tunisie" },
] as const;

export function phoneDialCodeFieldName(name: string): string {
  return `${name}__dialCode`;
}

export function isPhoneField(field: FormFieldItem): boolean {
  if (field.type === "tel") return true;
  const signature = `${field.name ?? ""} ${field.label ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /(^|[\s_-])(phone|tel|telephone|mobile|whatsapp)([\s_-]|$)/.test(signature);
}

export function combinePhoneNumber(
  dialCode: FormDataEntryValue | null,
  localNumber: FormDataEntryValue | null,
): string | null {
  if (typeof localNumber !== "string") return null;
  const localDigits = localNumber.replace(/\D/g, "");
  if (!localDigits) return null;
  const dialDigits =
    typeof dialCode === "string" ? dialCode.replace(/\D/g, "") : "33";
  const internationalLocal = localDigits.replace(/^0+/, "");
  return `+${dialDigits}${internationalLocal}`;
}

