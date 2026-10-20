import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { QuoteForm } from "@/components/quote-form";
import { PageHeader } from "@/components/ui";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSeeCosts } from "@/lib/domain";
import { centsToInput, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Editar orçamento" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const order = await prisma.workOrder.findUnique({
    where: { id: (await params).id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!order) notFound();
  if (["CANCELLED", "REFUSED"].includes(order.status)) redirect(`/os/${order.id}`);
  if (!["QUOTE", "AWAITING_APPROVAL"].includes(order.status) && user.role !== "OWNER") redirect(`/os/${order.id}`);
  const [clients, catalog, applicators] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, include: { vehicles: { orderBy: { plate: "asc" } } } }),
    prisma.catalogItem.findMany({
      where: { type: { not: "RESALE" } },
      include: { components: { include: { component: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({ where: { role: "APPLICATOR", active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title={`Editar orçamento ${order.number}`}
        description={
          ["QUOTE", "AWAITING_APPROVAL"].includes(order.status)
            ? "A alteração fica no histórico da ordem."
            : "A ordem já foi aprovada. O valor anterior fica registrado."
        }
      />
      <QuoteForm
        orderId={order.id}
        canSeeCosts={canSeeCosts(user.role)}
        clients={clients.map((client) => ({ id: client.id, name: client.name, phone: client.phone, type: client.type, vehicles: client.vehicles }))}
        catalog={catalog.map((item) => ({
          id: item.id,
          type: item.type,
          name: item.name,
          description: item.description,
          priceCents: item.priceCents,
          costCents: item.costCents,
          billing: item.billing,
          active: item.active,
          partnerId: item.partnerId,
          components: item.components.map((component) => ({ name: component.component.name, costCents: component.component.costCents })),
        }))}
        applicators={applicators.map((person) => ({ id: person.id, name: person.name }))}
        initial={{
          clientId: order.clientId,
          vehicleId: order.vehicleId ?? "",
          discount: order.discountCents ? centsToInput(order.discountCents) : "",
          notes: order.notes,
          assignedToId: order.assignedToId ?? "",
          items: order.items
            .filter((item) => item.catalogItemId)
            .map((item) => ({
              catalogItemId: item.catalogItemId as string,
              quantity: formatNumber(item.quantity),
              meters: item.meters ? formatNumber(item.meters) : "",
              price: centsToInput(item.unitPriceCents),
            })),
        }}
      />
    </div>
  );
}
