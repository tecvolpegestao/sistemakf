import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSeeMoney, totalsOf } from "@/lib/domain";
import { formatBRL, formatDate, startOfMonth } from "@/lib/format";
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
    include: { client: true, vehicle: true, items: true, payments: true },
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
      </div>
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
          Situações: {Object.values(STATUS_LABEL).slice(0, 6).join(", ")}. Custo real e fechamento com parceiros entram nas próximas fases.
        </p>
      ) : null}
    </div>
  );
}
