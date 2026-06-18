import { redirect } from "next/navigation";

// Le CRM Contacts est désormais intégré dans la section « Leads ».
export default function CrmContactsRedirect() {
  redirect("/leads");
}
