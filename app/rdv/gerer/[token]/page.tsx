// app/rdv/gerer/[token]/page.tsx
//
// Page d'annulation par jeton — accessible sans compte.
// Le jeton fait office d'authentification (même principe qu'un lien de
// désinscription) : il n'apparaît que dans l'e-mail du visiteur.

import type { Metadata } from "next";
import { ManageBooking } from "@/components/booking/ManageBooking";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gérer mon rendez-vous",
  robots: { index: false, follow: false },
};

export default async function ManageBookingPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 text-white">
      <ManageBooking token={token} />
    </main>
  );
}
