import type { FormFieldItem } from "@/lib/funnels/types";

export const PHONE_DIAL_CODES = [
  { code: "+33", country: "France", iso: "FR" },
  { code: "+32", country: "Belgique", iso: "BE" },
  { code: "+41", country: "Suisse", iso: "CH" },
  { code: "+1", country: "Canada / USA", iso: "CA" },
  { code: "+237", country: "Cameroun", iso: "CM" },
  { code: "+225", country: "Côte d’Ivoire", iso: "CI" },
  { code: "+221", country: "Sénégal", iso: "SN" },
  { code: "+223", country: "Mali", iso: "ML" },
  { code: "+226", country: "Burkina Faso", iso: "BF" },
  { code: "+229", country: "Bénin", iso: "BJ" },
  { code: "+228", country: "Togo", iso: "TG" },
  { code: "+224", country: "Guinée", iso: "GN" },
  { code: "+241", country: "Gabon", iso: "GA" },
  { code: "+242", country: "Congo", iso: "CG" },
  { code: "+243", country: "RDC", iso: "CD" },
  { code: "+212", country: "Maroc", iso: "MA" },
  { code: "+213", country: "Algérie", iso: "DZ" },
  { code: "+216", country: "Tunisie", iso: "TN" },
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
