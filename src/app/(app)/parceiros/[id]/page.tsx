import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { VehicleForm } from "@/components/vehicle-form";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { totalsOf } from "@/lib/domain";
import { formatBRL, formatDate, formatPhone, whatsAppUrl } from "@/lib/format";
import type { ServiceStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Parceiro" };

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const partner = await prisma.client.findUnique({
    where: { id: (await params).id },
    include: {
      packages: { where: { active: true }, include: { components: { include: { component: true } } } },
      vehicles: { orderBy: { plate: "asc" } },
      orders: { include: { vehicle: true, items: true, payments: true }, orderBy: { number: "desc" } },
    },
  });
  if (!partner || partner.type !== "PARTNER") notFound();
  const openOrders = partner.orders.filter((order) => order.status === "DELIVERED" && totalsOf(order).balanceCents > 0);
  const open = openOrders.reduce((sum, order) => sum + totalsOf(order).balanceCents, 0);
  const whatsApp = partner.phone ? whatsAppUrl(partner.phone, `Olá, ${partner.name}. Aqui é da KF Detail.`) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={partner.tradeName || partner.name}
        description={[partner.phone ? formatPhone(partner.phone) : null, partner.city || null].filter(Boolean).join(" · ")}
        actions={
          <>
            <ButtonLink href={`/clientes/${partner.id}/editar`} variant="secondary">
              Editar
            </ButtonLink>
            <ButtonLink href={`/os/nova?cliente=${partner.id}`}>Novo orçamento</ButtonLink>
            {whatsApp ? (
              <ButtonLink href={whatsApp} variant="secondary">
                WhatsApp
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <div className="flex flex-wrap items-start gap-4">
        {partner.logoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={partner.logoPath} alt="" className="h-16 w-auto rounded-md border border-line bg-bg p-2" />
        ) : null}
        <Panel className="min-w-48">
          <div className="text-sm text-muted">Em aberto</div>
          <div className="font-display text-2xl tabular-nums">{formatBRL(open)}</div>
        </Panel>
      </div>
      {partner.notes ? <p className="text-sm text-muted">{partner.notes}</p> : null}
      <Panel>
        <h2 className="font-display text-lg">Pacotes e preços</h2>
        <ul className="mt-2 space-y-3">
          {partner.packages.map((item) => (
            <li key={item.id}>
              <Link href={`/catalogo/${item.id}`} className="font-medium text-link">
                {item.name} · {formatBRL(item.priceCents)} por veículo
              </Link>
              <p className="text-sm text-muted">{item.components.map((component) => component.component.name).join(", ")}</p>
            </li>
          ))}
          {partner.packages.length === 0 ? <li className="text-sm text-muted">Nenhum pacote exclusivo. O preço sai do catálogo geral.</li> : null}
        </ul>
      </Panel>
      <Panel>
        <h2 className="font-display text-lg">Veículos atendidos</h2>
        <ul className="mt-2 divide-y divide-line">
          {partner.vehicles.map((vehicle) => (
            <li key={vehicle.id} className="py-2">
              <Link className="text-link" href={`/veiculos/${vehicle.id}`}>
                {vehicle.plate} · {vehicle.brand} {vehicle.model}
              </Link>
            </li>
          ))}
          {partner.vehicles.length === 0 ? <li className="py-2 text-sm text-muted">Nenhum veículo ainda.</li> : null}
        </ul>
        <div className="mt-4">
          <VehicleForm clients={[{ id: partner.id, name: partner.name }]} />
        </div>
      </Panel>
      <Panel>
        <h2 className="font-display text-lg">Ordens</h2>
        <ul className="mt-2 divide-y divide-line">
          {partner.orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <Link href={`/os/${order.id}`} className="text-link">
                {order.number} · {order.vehicle?.plate ?? "Sem veículo"} · {formatDate(order.createdAt)}
              </Link>
              <StatusBadge status={order.status as ServiceStatus} />
              <span className="tabular-nums">{formatBRL(totalsOf(order).balanceCents > 0 ? totalsOf(order).balanceCents : totalsOf(order).totalCents)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
