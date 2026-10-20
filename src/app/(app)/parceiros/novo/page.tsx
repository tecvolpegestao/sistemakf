import type { Metadata } from "next";
import { ClientForm } from "@/components/client-form";
import { PageHeader } from "@/components/ui";
import { requireRoles } from "@/lib/auth";

export const metadata: Metadata = { title: "Novo parceiro" };

export default async function NewPartnerPage() {
  await requireRoles(["OWNER", "ATTENDANT"]);
  return (
    <div>
      <PageHeader title="Novo parceiro" description="A logo entra no orçamento quando o serviço for para esta loja." />
      <ClientForm lockPartner />
    </div>
  );
}
