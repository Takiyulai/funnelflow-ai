// app/(app)/messagerie/page.tsx
// 🆕 Boîte de réception des conversations (Telegram en v1, WhatsApp ensuite).

import { AppShell } from "@/components/dashboard/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { MessagingInbox } from "@/components/messaging/MessagingInbox";

export const dynamic = "force-dynamic";

export default function MessageriePage() {
  return (
    <AppShell>
      <PageHeader
        title="Messagerie"
        subtitle="Réponds à tes prospects sans quitter AutoFunnel."
      />
      <MessagingInbox />
    </AppShell>
  );
}
