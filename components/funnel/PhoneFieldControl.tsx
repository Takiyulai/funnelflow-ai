"use client";

import { useState, type CSSProperties, type RefObject } from "react";
import type { FormFieldItem } from "@/lib/funnels/types";
import { flagUrl } from "@/lib/crm/phone";
import {
  PHONE_DIAL_CODES,
  phoneDialCodeFieldName,
} from "@/lib/funnels/phone";

export function PhoneFieldControl({
  field,
  disabled,
  inputClassName,
  inputStyle,
  inputRef,
}: {
  field: FormFieldItem;
  disabled: boolean;
  inputClassName: string;
  inputStyle?: CSSProperties;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const defaultCode = field.countryCode || "+33";
  const defaultCountry =
    PHONE_DIAL_CODES.find((entry) => entry.code === defaultCode) ??
    PHONE_DIAL_CODES[0];
  const countryId = (iso: string, code: string) => `${iso}:${code}`;
  const [selectedCountryId, setSelectedCountryId] = useState(
    countryId(defaultCountry.iso, defaultCountry.code),
  );
  const selectedCountry =
    PHONE_DIAL_CODES.find(
      (entry) => countryId(entry.iso, entry.code) === selectedCountryId,
    ) ?? defaultCountry;
  const selectedFlagUrl = flagUrl(selectedCountry.iso, 40);
  return (
    <div className="grid min-w-0 grid-cols-[132px_minmax(0,1fr)] gap-2 max-[420px]:grid-cols-[116px_minmax(0,1fr)]">
      <div className="relative min-w-0">
        {selectedFlagUrl && (
          // Les emojis de drapeau ne sont pas fiables sous Windows/Chrome.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selectedFlagUrl}
            alt=""
            width={20}
            height={14}
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-[14px] w-5 -translate-y-1/2 rounded-[2px] object-cover"
          />
        )}
        <select
          value={selectedCountryId}
          onChange={(event) => setSelectedCountryId(event.target.value)}
          disabled={disabled}
          aria-label="Indicatif du pays"
          className={`${inputClassName} min-w-0 pl-10 pr-2`}
          style={inputStyle}
        >
          {PHONE_DIAL_CODES.map((entry) => (
            <option
              key={`${entry.iso}-${entry.code}`}
              value={countryId(entry.iso, entry.code)}
            >
              {entry.code} · {entry.country}
            </option>
          ))}
        </select>
        <input
          type="hidden"
          name={phoneDialCodeFieldName(field.name)}
          value={selectedCountry.code}
        />
      </div>
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]{5,15}"
        maxLength={15}
        name={field.name}
        placeholder={field.placeholder || "Numéro de téléphone"}
        required={field.required}
        disabled={disabled}
        className={`${inputClassName} min-w-0`}
        style={inputStyle}
        onInput={(event) => {
          event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
        }}
      />
    </div>
  );
}
