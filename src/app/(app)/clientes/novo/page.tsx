import type { Metadata } from "next";
import { ClientForm } from "@/components/client-form";
import { PageHeader } from "@/components/ui";
import { requireRoles } from "@/lib/auth";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NewClientPage() {
  await requireRoles(["OWNER", "ATTENDANT"]);
  return (
    <div>
      <PageHeader title="Novo cliente" description="O telefone repetido gera um aviso antes de salvar." />
      <ClientForm />
    </div>
  );
}
