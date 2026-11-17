import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { VehicleForm } from "@/components/vehicle-form";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { totalsOf } from "@/lib/domain";
import { formatBRL, formatDate, vehicleLine } from "@/lib/format";
import type { ServiceStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Veículo" };

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: (await params).id },
    include: {
      client: true,
      orders: { include: { items: true, payments: true }, orderBy: { number: "desc" } },
    },
  });
  if (!vehicle) notFound();
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div className="space-y-6">
      <PageHeader
        title={vehicle.plate}
        description={vehicleLine(vehicle)}
        actions={
          <ButtonLink href={`/os/nova?cliente=${vehicle.clientId}&veiculo=${vehicle.id}`}>Novo orçamento</ButtonLink>
        }
      />
      <p className="text-sm text-muted">
        Cliente:{" "}
        <Link className="text-link" href={vehicle.client.type === "PARTNER" ? `/parceiros/${vehicle.clientId}` : `/clientes/${vehicle.clientId}`}>
          {vehicle.client.name}
        </Link>
      </p>
      <Panel>
        <h2 className="font-display text-lg">Serviços neste veículo</h2>
        <ul className="mt-2 divide-y divide-line">
          {vehicle.orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <Link href={`/os/${order.id}`} className="text-link">
                {order.number} · {formatDate(order.createdAt)}
              </Link>
              <StatusBadge status={order.status as ServiceStatus} />
              <span className="tabular-nums">{formatBRL(totalsOf(order).totalCents)}</span>
              <span className="text-muted">{order.items.map((item) => item.name).join(", ")}</span>
            </li>
          ))}
          {vehicle.orders.length === 0 ? <li className="py-2 text-sm text-muted">Nenhum serviço registrado.</li> : null}
        </ul>
      </Panel>
      <Panel>
        <h2 className="font-display text-lg">Editar</h2>
        <p className="mb-3 text-sm text-muted">Trocar o cliente mantém o histórico no veículo.</p>
        <VehicleForm clients={clients} vehicle={vehicle} />
      </Panel>
    </div>
  );
}
