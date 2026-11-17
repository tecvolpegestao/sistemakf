import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSeeCosts, canSeeMoney, marginRatio, totalsOf } from "@/lib/domain";
import { formatBRL, formatDate, formatPercent, startOfMonth } from "@/lib/format";
import { consumptionCost, loadStock } from "@/lib/inventory";
import { STATUS_LABEL } from "@/lib/labels";
import type { ServiceStatus } from "@/lib/types";
import { ButtonLink, PageHeader, Panel, PaymentBadge, Stat, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Painel" };

export default async function DashboardPage() {
  const user = await requireUser();
  const showMoney = canSeeMoney(user.role);
  const monthStart = startOfMonth();
  const orders = await prisma.workOrder.findMany({
    where: user.role === "APPLICATOR" ? { assignedToId: user.id } : undefined,
    include: { client: true, vehicle: true, items: true, payments: true, movements: true },
    orderBy: { updatedAt: "desc" },
  });
  const active = orders.filter((order) => ["APPROVED", "IN_PROGRESS", "READY"].includes(order.status));
  const ready = orders.filter((order) => order.status === "READY");
  const deliveredOpen = orders.filter((order) => order.status === "DELIVERED" && totalsOf(order).balanceCents > 0);
  const openCents = deliveredOpen.reduce((sum, order) => sum + totalsOf(order).balanceCents, 0);
  const received = showMoney
    ? await prisma.payment.aggregate({ _sum: { amountCents: true }, where: { paidAt: { gte: monthStart } } })
    : null;
  const mine = user.role === "APPLICATOR" ? orders.filter((order) => ["APPROVED", "IN_PROGRESS"].includes(order.status)) : active;
  const showCosts = canSeeCosts(user.role);
  const stock = showMoney ? await loadStock() : [];
  const lowStock = stock.filter((item) => item.low);
  const monthSales = showMoney
    ? await prisma.sale.findMany({
        where: { status: { not: "CANCELLED" }, createdAt: { gte: monthStart } },
        include: { items: true },
      })
    : [];
  const salesCents = monthSales.reduce(
    (sum, sale) => sum + sale.items.reduce((inner, item) => inner + Math.round(item.quantity * item.unitPriceCents), 0),
    0,
  );
  const openSettlements = showMoney ? await prisma.settlement.count({ where: { status: "OPEN" } }) : 0;
  const deliveredMonth = orders.filter((order) => order.status === "DELIVERED" && order.deliveredAt && order.deliveredAt >= monthStart);
  const deliveredPrice = deliveredMonth.reduce((sum, order) => sum + totalsOf(order).totalCents, 0);
  const deliveredReal = deliveredMonth.reduce(
    (sum, order) => sum + order.movements.filter((movement) => movement.kind === "OUT").reduce((inner, movement) => inner + consumptionCost(movement.quantity, movement.unitCostCents), 0),
    0,
  );
  const counts = (["QUOTE", "AWAITING_APPROVAL", "APPROVED", "IN_PROGRESS", "READY", "DELIVERED"] as ServiceStatus[]).map((status) => ({
    status,
    count: orders.filter((order) => order.status === status).length,
  }));

  return (
    <div>
      <PageHeader
        title={user.role === "APPLICATOR" ? "Minhas ordens" : "Painel"}
        description={
          user.role === "APPLICATOR"
            ? "Ordens atribuídas a você e as etapas em aberto."
            : "O que está em atendimento, pronto para sair e ainda sem pagamento."
        }
        actions={showMoney ? <ButtonLink href="/os/nova">Novo orçamento</ButtonLink> : undefined}
      />
      <div className={`grid gap-3 ${showMoney ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2"}`}>
        <Stat label="Em atendimento" value={String(active.length)} href="/os?status=IN_PROGRESS" hint="Aprovadas, em execução ou prontas" />
        <Stat label="Prontos" value={String(ready.length)} href="/os?status=READY" hint="Ainda não entregues" />
        {showMoney ? <Stat label="A receber" value={formatBRL(openCents)} href="/a-receber" hint="Entregues e não pagos" /> : null}
        {showMoney ? (
          <Stat label="Recebido no mês" value={formatBRL(received?._sum.amountCents ?? 0)} href="/recebimentos" />
        ) : null}
        {showMoney ? <Stat label="Vendas do mês" value={formatBRL(salesCents)} href="/vendas" hint="Fora das ordens de serviço" /> : null}
        {showMoney ? <Stat label="Estoque baixo" value={String(lowStock.length)} href="/estoque" hint="Abaixo do mínimo" /> : null}
        {showMoney ? <Stat label="Fechamentos" value={String(openSettlements)} href="/fechamentos" hint="Semanas ainda em aberto" /> : null}
        {showCosts ? (
          <Stat
            label="Margem real do mês"
            value={deliveredReal > 0 ? formatPercent(marginRatio(deliveredPrice, deliveredReal)) : "—"}
            hint="Entregues no mês, pelo consumo lançado"
          />
        ) : null}
      </div>
      {showMoney ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {counts.map((item) => (
            <Link key={item.status} href={`/os?status=${item.status}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-sm">
              <span className="text-muted">{STATUS_LABEL[item.status]}</span>
              <span className="tabular-nums">{item.count}</span>
            </Link>
          ))}
        </div>
      ) : null}
      {lowStock.length > 0 && showMoney ? (
        <Panel className="mt-4">
          <h2 className="font-display text-lg">Para repor</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {lowStock.map((item) => (
              <li key={item.id}>
                {item.name}: {item.quantity} {item.unit || "un"} · mínimo {item.minStock}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel className="mt-6">
        <h2 className="font-display text-lg">{user.role === "APPLICATOR" ? "Para executar" : "Veículos em atendimento"}</h2>
        <ul className="mt-3 divide-y divide-line">
          {mine.slice(0, 8).map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <Link href={`/os/${order.id}`} className="font-medium text-link">
                  {order.vehicle?.plate ?? "Sem placa"} · {order.vehicle ? `${order.vehicle.brand} ${order.vehicle.model}` : order.client.name}
                </Link>
                <div className="mt-1 text-sm text-muted">
                  OS {order.number} · {order.client.name} · {formatDate(order.updatedAt)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={order.status as ServiceStatus} />
                {showMoney ? <PaymentBadge status={totalsOf(order).paymentStatus} /> : null}
              </div>
            </li>
          ))}
          {mine.length === 0 ? <li className="py-6 text-sm text-muted">Nenhum veículo em atendimento.</li> : null}
        </ul>
      </Panel>
      {showMoney ? (
        <p className="mt-4 text-xs text-muted">
          Situações: {Object.values(STATUS_LABEL).slice(0, 6).join(", ")}. A margem real usa o consumo lançado nas ordens entregues no mês.
        </p>
      ) : null}
    </div>
  );
}
