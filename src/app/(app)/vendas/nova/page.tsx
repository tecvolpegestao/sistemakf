import type { Metadata } from "next";
import { SaleForm } from "@/components/sale-form";
import { PageHeader } from "@/components/ui";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadStock } from "@/lib/inventory";

export const metadata: Metadata = { title: "Nova venda" };

export default async function NewSalePage() {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const [stock, clients] = await Promise.all([
    loadStock(),
    prisma.client.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const products = stock
    .filter((item) => item.type === "RESALE" && item.active)
    .map((item) => ({ id: item.id, name: item.name, priceCents: item.priceCents, unit: item.unit || "un", onHand: item.quantity }));

  return (
    <div>
      <PageHeader title="Nova venda" description="Aromatizante e outros produtos de revenda, com baixa imediata do estoque." />
      <SaleForm products={products} clients={clients.map((client) => ({ id: client.id, name: client.name }))} />
    </div>
  );
}
