"use client";

import type {
  FunnelSection,
  SectionItem,
  FormFieldItem,
} from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
};

export function FormRenderer({ section }: Props) {
  const fields = (section.items || [])
    .filter(
      (it): it is SectionItem & { kind: "formField" } =>
        it.kind === "formField",
    )
    .map((it) => it.data);

  const ctaLabel = section.cta?.label || "Envoyer";

  if (fields.length === 0) {
    // Fallback si la section vient d'être créée et n'a pas encore de champs
    return (
      <form
        id="lead-form"
        onSubmit={(e) => e.preventDefault()}
        className="mx-auto mt-4 max-w-md space-y-3 rounded-lg p-4"
      >
        <input
          type="text"
          placeholder="Votre prénom"
          className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors"
          style={{
            border: "1px solid var(--ff-border, rgba(0,0,0,0.12))",
            background: "rgba(255,255,255,0.06)",
            color: "var(--ff-ink, #0f172a)",
          }}
        />
        <input
          type="email"
          placeholder="Votre email"
          className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors"
          style={{
            border: "1px solid var(--ff-border, rgba(0,0,0,0.12))",
            background: "rgba(255,255,255,0.06)",
            color: "var(--ff-ink, #0f172a)",
          }}
        />
        <button
  type="submit"
  className="mt-4 w-full px-4 py-2.5 text-sm font-bold transition rounded-lg"
  data-ff-cta
  style={{
    background: "var(--ff-accent, #2563eb)",
    color: "var(--ff-accent-ink, #ffffff)",
    border: "none",
    cursor: "pointer",
  }}
>
  {ctaLabel}
</button>

      </form>
    );
  }

  return (
    <form
      id="lead-form"
      onSubmit={(e) => e.preventDefault()}
      className="mx-auto mt-4 max-w-md rounded-lg p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f, idx) => (
          <FieldBlock key={`${f.name}-${idx}`} field={f} />
        ))}
      </div>
      <button
  type="submit"
  className="mt-4 w-full px-4 py-2.5 text-sm font-bold transition rounded-lg"
  data-ff-cta
  style={{
    background: "var(--ff-accent, #2563eb)",
    color: "var(--ff-accent-ink, #ffffff)",
    border: "none",
    cursor: "pointer",
  }}
>
  {ctaLabel}
</button>

    </form>
  );
}

function FieldBlock({ field }: { field: FormFieldItem }) {
  const colSpan = field.width === "half" ? "col-span-1" : "col-span-2";
  const inputStyle: React.CSSProperties = {
    border: "1px solid var(--ff-border, rgba(0,0,0,0.12))",
    background: "rgba(255,255,255,0.06)",
    color: "var(--ff-ink, #0f172a)",
  };
  const inputClass =
    "w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors";

  if (field.type === "checkbox") {
    return (
      <label className={`${colSpan} flex items-center gap-2 text-sm`}>
        <input
          type="checkbox"
          name={field.name}
          required={field.required}
          className="h-4 w-4 cursor-pointer accent-current"
        />
        <span style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.85 }}>
          {field.label || "Cocher"}
          {field.required && <span style={{ color: "#ef4444" }}> *</span>}
        </span>
      </label>
    );
  }

  return (
    <div className={colSpan}>
      {field.label && (
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.85 }}
        >
          {field.label}
          {field.required && <span style={{ color: "#ef4444" }}> *</span>}
        </label>
      )}

      {field.type === "textarea" ? (
        <textarea
          name={field.name}
          placeholder={field.placeholder}
          required={field.required}
          rows={3}
          className={`${inputClass} resize-y`}
          style={inputStyle}
        />
      ) : field.type === "select" ? (
        <select
          name={field.name}
          required={field.required}
          className={inputClass}
          style={inputStyle}
          defaultValue=""
        >
          <option value="" disabled>
            {field.placeholder || "Sélectionner…"}
          </option>
          {(field.options || []).map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type}
          name={field.name}
          placeholder={field.placeholder}
          required={field.required}
          className={inputClass}
          style={inputStyle}
        />
      )}
    </div>
  );
}
