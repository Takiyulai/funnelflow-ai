import { Resend } from "resend";
import type { EmailSequenceItem } from "@/lib/funnels/types";

export function createResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required to send emails.");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendSequenceEmail(to: string, email: EmailSequenceItem) {
  const resend = createResendClient();
  return resend.emails.send({
    from: process.env.RESEND_FROM ?? "FunnelFlow AI <hello@example.com>",
    to,
    subject: email.subject,
    html: email.html,
    text: email.text
  });
}
