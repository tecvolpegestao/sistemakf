import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { ComboBox } from "@/components/combo-box";
import { OrderTable, type OrderRow } from "@/components/order-table";
import { ButtonLink, PageHeader, PaymentBadge, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { asStatus, canSeeMoney, totalsOf } from "@/lib/domain";
import { parseDateInput, queryValue, withParams } from "@/lib/format";
import { PAYMENT_LABEL, STATUS_LABEL } from "@/lib/labels";
import { BOARD_STATUSES, type PaymentStatus, type ServiceStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Ordens de serviço" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const current = {
    q: queryValue(sp.q).trim(),
    status: queryValue(sp.status),
    payment: queryValue(sp.payment),
    partner: queryValue(sp.partner),
    from: queryValue(sp.from),
    to: queryValue(sp.to),
    view: queryValue(sp.view) || "table",
  };
  const showMoney = canSeeMoney(user.role);
  const status = asStatus(current.status);
  const number = /^\d+$/.test(current.q) ? Number(current.q) : null;
  const from = parseDateInput(current.from);
  const to = parseDateInput(current.to, true);
  const where: Prisma.WorkOrderWhereInput = {
    AND: [
      user.role === "APPLICATOR" ? { assignedToId: user.id } : {},
      status ? { status } : {},
      current.payment ? { paymentStatus: current.payment } : {},
      current.partner ? { clientId: current.partner } : {},
      from || to ? { createdAt: { gte: from ?? undefined, lte: to ?? undefined } } : {},
      current.q
        ? {
            OR: [
              { client: { name: { contains: current.q } } },
              { vehicle: { plate: { contains: current.q.toUpperCase().replace(/[^A-Z0-9]/g, "") } } },
              ...(number ? [{ number }] : []),
            ],
          }
        : {},
    ],
  };
  const [orders, partners] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      include: { client: true, vehicle: true, items: true, payments: true },
      orderBy: { number: "desc" },
    }),
    prisma.client.findMany({ where: { type: "PARTNER" }, orderBy: { name: "asc" } }),
  ]);
  const rows: OrderRow[] = orders.map((order) => {
    const totals = totalsOf(order);
    return {
      id: order.id,
      number: order.number,
      status: (asStatus(order.status) ?? "QUOTE") as ServiceStatus,
      paymentStatus: totals.paymentStatus,
      totalCents: totals.totalCents,
      createdAt: order.createdAt,
      clientName: order.client.name,
      vehicle: order.vehicle ? `${order.vehicle.plate} · ${order.vehicle.model}` : "",
    };
  });
  const columns: ServiceStatus[] =
    status && (status === "REFUSED" || status === "CANCELLED") ? [status] : [...BOARD_STATUSES];

  return (
    <div>
      <PageHeader
        title="Ordens de serviço"
        description="Do orçamento à entrega. A situação do serviço e a do pagamento andam separadas."
        actions={showMoney ? <ButtonLink href="/os/nova">Novo orçamento</ButtonLink> : undefined}
      />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={current.q} className="field w-full sm:w-64" placeholder="Cliente, placa ou número" aria-label="Buscar ordem" />
        <div className="w-full sm:w-48">
          <ComboBox
            name="status"
            ariaLabel="Situação"
            placeholder="Serviço"
            defaultValue={current.status}
            options={[{ value: "", label: "Serviço" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]}
          />
        </div>
        {showMoney ? (
          <div className="w-full sm:w-44">
            <ComboBox
              name="payment"
              ariaLabel="Pagamento"
              placeholder="Pagamento"
              defaultValue={current.payment}
              options={[{ value: "", label: "Pagamento" }, ...Object.entries(PAYMENT_LABEL).map(([value, label]) => ({ value, label }))]}
            />
          </div>
        ) : (
          <input type="hidden" name="payment" value="" />
        )}
        <div className="w-full sm:w-48">
          <ComboBox
            name="partner"
            ariaLabel="Parceiro"
            placeholder="Parceiro"
            defaultValue={current.partner}
            options={[{ value: "", label: "Parceiro" }, ...partners.map((partner) => ({ value: partner.id, label: partner.name }))]}
          />
        </div>
        <input name="from" type="date" defaultValue={current.from} className="field w-full sm:w-40" aria-label="De" />
        <input name="to" type="date" defaultValue={current.to} className="field w-full sm:w-40" aria-label="Até" />
        <input type="hidden" name="view" value={current.view} />
        <button className="button-line" type="submit">
          Filtrar
        </button>
      </form>
      <div className="mb-4 flex gap-2 text-sm">
        <Link href={withParams("/os", current, { view: "table" })} className={current.view === "board" ? "text-muted" : "text-link"}>
          Tabela
        </Link>
        <Link href={withParams("/os", current, { view: "board" })} className={current.view === "board" ? "text-link" : "text-muted"}>
          Quadro
        </Link>
      </div>
      {current.view === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((column) => {
            const cards = rows.filter((row) => row.status === column);
            return (
              <section key={column} className="w-72 shrink-0">
                <header className="mb-2 flex items-center justify-between text-sm">
                  <span>{STATUS_LABEL[column]}</span>
                  <span className="text-muted">{cards.length}</span>
                </header>
                <div className="space-y-2">
                  {cards.map((card) => (
                    <Link key={card.id} href={`/os/${card.id}`} className="block rounded-lg border border-line bg-card p-3">
                      <div className="font-medium">{card.vehicle || card.clientName}</div>
                      <div className="mt-1 text-xs text-muted">
                        {card.number} · {card.clientName}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <StatusBadge status={card.status} />
                        {showMoney ? <PaymentBadge status={card.paymentStatus as PaymentStatus} /> : null}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <OrderTable rows={rows} showMoney={showMoney} />
      )}
    </div>
  );
}
