import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { PageHeader } from "@/components/ui";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const client = await prisma.client.findUnique({ where: { id: (await params).id } });
  if (!client) notFound();
  return (
    <div>
      <PageHeader title={`Editar ${client.name}`} />
      <ClientForm client={client} />
    </div>
  );
}
