// app/(app)/messagerie/page.tsx
// 🆕 Boîte de réception des conversations (Telegram en v1, WhatsApp ensuite).

import { AppShell } from "@/components/dashboard/AppShell";
import { MessagingInbox } from "@/components/messaging/MessagingInbox";

export const dynamic = "force-dynamic";

export default function MessageriePage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-black text-ink">Messagerie</h1>
        <p className="mt-2 text-sm text-muted">
          Réponds à tes prospects sans quitter AutoFunnel.
        </p>
      </div>
      <MessagingInbox />
    </AppShell>
  );
}
