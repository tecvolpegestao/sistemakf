import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManage, canSeeMoney, normalizePhone, normalizePlate, totalsOf } from "@/lib/domain";
import { formatBRL, queryValue } from "@/lib/format";
import { Empty, PageHeader, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "Busca" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = queryValue((await searchParams).q).trim();
  const plate = normalizePlate(q);
  const phone = normalizePhone(q);
  const number = /^\d+$/.test(q) ? Number(q) : null;
  if (!q) {
    return (
      <div>
        <PageHeader title="Busca" description="Procure por placa, cliente, telefone ou número da ordem." />
        <Empty title="Digite um termo na busca do topo" />
      </div>
    );
  }

  const [clients, vehicles, orders] = await Promise.all([
    canManage(user.role)
      ? prisma.client.findMany({
          where: {
            OR: [
              { name: { contains: q } },
              ...(phone ? [{ phone: { contains: phone } }] : []),
            ],
          },
          take: 12,
        })
      : Promise.resolve([]),
    canManage(user.role)
      ? prisma.vehicle.findMany({
          where: {
            OR: [
              ...(plate ? [{ plate: { contains: plate } }] : []),
              { model: { contains: q } },
              { brand: { contains: q } },
            ],
          },
          include: { client: true },
          take: 12,
        })
      : Promise.resolve([]),
    prisma.workOrder.findMany({
      where: {
        AND: [
          user.role === "APPLICATOR" ? { assignedToId: user.id } : {},
          {
            OR: [
              { client: { name: { contains: q } } },
              ...(plate ? [{ vehicle: { plate: { contains: plate } } }] : []),
              ...(number ? [{ number }] : []),
            ],
          },
        ],
      },
      include: { client: true, vehicle: true, items: true, payments: true },
      take: 12,
      orderBy: { number: "desc" },
    }),
  ]);

  const empty = clients.length + vehicles.length + orders.length === 0;
  return (
    <div className="space-y-6">
      <PageHeader title={`Busca por “${q}”`} />
      {empty ? <Empty title="Nenhum resultado" /> : null}
      {clients.length > 0 ? (
        <Panel>
          <h2 className="font-display text-lg">Clientes</h2>
          <ul className="mt-2 divide-y divide-line">
            {clients.map((client) => (
              <li key={client.id} className="py-2">
                <Link className="text-link" href={client.type === "PARTNER" ? `/parceiros/${client.id}` : `/clientes/${client.id}`}>
                  {client.name}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      {vehicles.length > 0 ? (
        <Panel>
          <h2 className="font-display text-lg">Veículos</h2>
          <ul className="mt-2 divide-y divide-line">
            {vehicles.map((vehicle) => (
              <li key={vehicle.id} className="py-2">
                <Link className="text-link" href={`/veiculos/${vehicle.id}`}>
                  {vehicle.plate} · {vehicle.brand} {vehicle.model}
                </Link>
                <span className="ml-2 text-sm text-muted">{vehicle.client.name}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      {orders.length > 0 ? (
        <Panel>
          <h2 className="font-display text-lg">Ordens</h2>
          <ul className="mt-2 divide-y divide-line">
            {orders.map((order) => (
              <li key={order.id} className="flex justify-between gap-3 py-2">
                <Link className="text-link" href={`/os/${order.id}`}>
                  {order.number} · {order.vehicle?.plate ?? order.client.name}
                </Link>
                {canSeeMoney(user.role) ? <span className="tabular-nums">{formatBRL(totalsOf(order).totalCents)}</span> : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
