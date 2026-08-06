// app/rdv/[slug]/page.tsx
//
// Page publique de réservation — le lien autonome, partageable (type Calendly).
// Hors du groupe (app) : pas d'AppShell, pas de session requise.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventTypeBySlug } from "@/lib/booking/repository";
import { BookingWidget } from "@/components/booking/BookingWidget";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const eventType = await getEventTypeBySlug(slug);
  if (!eventType) return { title: "Réservation introuvable" };
  return {
    title: `${eventType.name} — Réserver un créneau`,
    description: eventType.description ?? undefined,
    // Une page de réservation n'a pas vocation à être indexée : elle est
    // partagée par lien direct, et son contenu change en permanence.
    robots: { index: false, follow: false },
  };
}

export default async function BookingPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const eventType = await getEventTypeBySlug(slug);
  if (!eventType || !eventType.active) notFound();

  return (
    // Fond légèrement dégradé plutôt qu'un noir plat : les cartes du widget
    // (bg-white/[0.04]) n'ont de relief que si l'arrière-plan n'est pas déjà
    // au maximum de noir.
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 px-4 py-10 text-white sm:py-14">
      <BookingWidget slug={slug} />
      <p className="mt-12 text-center text-xs text-white/25">Propulsé par AutoFunnel AI</p>
    </main>
  );
}
