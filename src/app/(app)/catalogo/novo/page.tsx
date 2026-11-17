import type { Metadata } from "next";
import { CatalogForm } from "@/components/catalog-form";
import { PageHeader } from "@/components/ui";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Novo item" };

export default async function NewCatalogPage() {
  await requireRoles(["OWNER"]);
  const [services, partners] = await Promise.all([
    prisma.catalogItem.findMany({
      where: { type: { in: ["LABOR", "MATERIAL_SERVICE"] }, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    prisma.client.findMany({ where: { type: "PARTNER" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Novo item" description="Desative em vez de apagar: orçamentos antigos continuam com o nome que foi vendido." />
      <CatalogForm services={services} partners={partners} />
    </div>
  );
}
