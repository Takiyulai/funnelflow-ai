"use client";

import type { CSSProperties, RefObject } from "react";
import type { FormFieldItem } from "@/lib/funnels/types";
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
  return (
    <div className="flex min-w-0 gap-2">
      <select
        name={phoneDialCodeFieldName(field.name)}
        defaultValue={defaultCode}
        disabled={disabled}
        aria-label="Indicatif du pays"
        className={`${inputClassName} w-[132px] shrink-0 px-2`}
        style={inputStyle}
      >
        {PHONE_DIAL_CODES.map((entry) => (
          <option key={`${entry.country}-${entry.code}`} value={entry.code}>
            {entry.country} {entry.code}
          </option>
        ))}
      </select>
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
        className={`${inputClassName} min-w-0 flex-1`}
        style={inputStyle}
        onInput={(event) => {
          event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
        }}
      />
    </div>
  );
}

