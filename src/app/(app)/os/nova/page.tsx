import type { Metadata } from "next";
import { QuoteForm } from "@/components/quote-form";
import { PageHeader } from "@/components/ui";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSeeCosts } from "@/lib/domain";
import { centsToInput, queryValue } from "@/lib/format";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; veiculo?: string }>;
}) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const params = await searchParams;
  const clientId = queryValue(params.cliente);
  const vehicleId = queryValue(params.veiculo);
  const [clients, catalog, applicators, vehicle] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      include: { vehicles: { orderBy: { plate: "asc" } } },
    }),
    prisma.catalogItem.findMany({
      where: { type: { not: "RESALE" } },
      include: { components: { include: { component: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({ where: { role: "APPLICATOR", active: true }, orderBy: { name: "asc" } }),
    vehicleId ? prisma.vehicle.findUnique({ where: { id: vehicleId } }) : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHeader
        title="Novo orçamento"
        description="Ao escolher um parceiro com pacote combinado, o preço já vem preenchido. PPF e película pedem a metragem prevista."
      />
      <QuoteForm
        canSeeCosts={canSeeCosts(user.role)}
        clients={clients.map((client) => ({
          id: client.id,
          name: client.name,
          phone: client.phone,
          type: client.type,
          vehicles: client.vehicles,
        }))}
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
          components: item.components.map((component) => ({
            name: component.component.name,
            costCents: component.component.costCents,
          })),
        }))}
        applicators={applicators.map((person) => ({ id: person.id, name: person.name }))}
        initial={{
          clientId: vehicle?.clientId || clientId,
          vehicleId: vehicle?.id || "",
          items: [],
          discount: centsToInput(0).replace("0,00", ""),
          notes: "",
          assignedToId: "",
        }}
      />
    </div>
  );
}
