import { redirect } from "next/navigation";

// Le CRM Contacts est désormais intégré dans la section « Leads ».
export default async function CrmContactRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/leads/${id}`);
}
