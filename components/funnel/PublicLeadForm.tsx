"use client";

import { useState } from "react";
import type { FormEvent } from "react";

export function PublicLeadForm({ funnelId }: { funnelId: string }) {
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        funnelId,
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? "")
      })
    });
    setMessage(response.ok ? "Merci, votre demande est enregistrée." : "Impossible d’enregistrer la demande.");
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-xl gap-3 rounded-lg border border-line bg-white p-6 shadow-premium">
      <h2 className="text-3xl font-black">Recevoir les détails</h2>
      <input name="name" className="min-h-12 rounded-lg border border-line px-3" placeholder="Nom" required />
      <input name="email" className="min-h-12 rounded-lg border border-line px-3" type="email" placeholder="Email" required />
      <input name="phone" className="min-h-12 rounded-lg border border-line px-3" placeholder="Téléphone" />
      <button className="min-h-12 rounded-lg bg-gold px-5 font-black text-navy" type="submit">Envoyer</button>
      {message ? <p className="text-sm font-semibold text-muted">{message}</p> : null}
    </form>
  );
}
