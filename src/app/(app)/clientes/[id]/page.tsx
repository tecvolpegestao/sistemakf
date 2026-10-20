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

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      vehicles: { orderBy: { plate: "asc" } },
      orders: { include: { vehicle: true, items: true, payments: true }, orderBy: { number: "desc" } },
    },
  });
  if (!client || client.type === "PARTNER") notFound();
  const spent = client.orders
    .filter((order) => !["QUOTE", "REFUSED", "CANCELLED"].includes(order.status))
    .reduce((sum, order) => sum + totalsOf(order).totalCents, 0);
  const open = client.orders
    .filter((order) => order.status === "DELIVERED")
    .reduce((sum, order) => sum + totalsOf(order).balanceCents, 0);
  const whatsApp = client.phone ? whatsAppUrl(client.phone, `Olá, ${client.name}. Aqui é da KF Detail.`) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={[client.phone ? formatPhone(client.phone) : null, client.email || null].filter(Boolean).join(" · ")}
        actions={
          <>
            <ButtonLink href={`/clientes/${client.id}/editar`} variant="secondary">
              Editar
            </ButtonLink>
            <ButtonLink href={`/os/nova?cliente=${client.id}`}>Novo orçamento</ButtonLink>
            {whatsApp ? (
              <ButtonLink href={whatsApp} variant="secondary">
                WhatsApp
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel>
          <div className="text-sm text-muted">Total em serviços</div>
          <div className="mt-1 font-display text-2xl tabular-nums">{formatBRL(spent)}</div>
        </Panel>
        <Panel>
          <div className="text-sm text-muted">Em aberto</div>
          <div className="mt-1 font-display text-2xl tabular-nums">{formatBRL(open)}</div>
        </Panel>
        <Panel>
          <div className="text-sm text-muted">Veículos</div>
          <div className="mt-1 font-display text-2xl tabular-nums">{client.vehicles.length}</div>
        </Panel>
      </div>
      {client.notes ? <p className="text-sm text-muted">{client.notes}</p> : null}
      <Panel>
        <h2 className="font-display text-lg">Veículos</h2>
        <ul className="mt-2 divide-y divide-line">
          {client.vehicles.map((vehicle) => (
            <li key={vehicle.id} className="py-2">
              <Link href={`/veiculos/${vehicle.id}`} className="font-medium text-link">
                {vehicle.plate} · {vehicle.brand} {vehicle.model}
              </Link>
              <span className="ml-2 text-sm text-muted">{[vehicle.year, vehicle.color].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
          {client.vehicles.length === 0 ? <li className="py-2 text-sm text-muted">Nenhum veículo ainda.</li> : null}
        </ul>
      </Panel>
      <Panel>
        <h2 className="font-display text-lg">Adicionar veículo</h2>
        <div className="mt-3">
          <VehicleForm clients={[{ id: client.id, name: client.name }]} />
        </div>
      </Panel>
      <Panel>
        <h2 className="font-display text-lg">Histórico</h2>
        <ul className="mt-2 divide-y divide-line">
          {client.orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <Link href={`/os/${order.id}`} className="text-link">
                {order.number} · {order.vehicle?.plate ?? "Sem veículo"}
              </Link>
              <span className="text-muted">{formatDate(order.createdAt)}</span>
              <StatusBadge status={order.status as ServiceStatus} />
              <span className="tabular-nums">{formatBRL(totalsOf(order).totalCents)}</span>
            </li>
          ))}
          {client.orders.length === 0 ? <li className="py-2 text-sm text-muted">Nenhum orçamento ainda.</li> : null}
        </ul>
      </Panel>
    </div>
  );
}
