import type { Metadata } from "next";
import { ComboBox } from "@/components/combo-box";
import { Alert, Button, Field, PageHeader, Panel } from "@/components/ui";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { totalsOf } from "@/lib/domain";
import { formatBRL, isWithin, queryValue, todayInput, weekRange } from "@/lib/format";
import { createSettlement } from "@/server/settlement-actions";

export const metadata: Metadata = { title: "Novo fechamento" };

export default async function NewSettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; parceiro?: string; semana?: string }>;
}) {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const params = await searchParams;
  const error = queryValue(params.erro);
  const partnerId = queryValue(params.parceiro);
  const weekInput = queryValue(params.semana) || todayInput();
  const range = weekRange(new Date(`${weekInput}T12:00:00-03:00`));
  const partners = await prisma.client.findMany({ where: { type: "PARTNER", active: true }, orderBy: { name: "asc" } });
  const orders = partnerId
    ? await prisma.workOrder.findMany({
        where: { clientId: partnerId, status: { in: ["READY", "DELIVERED"] }, settlementLine: { is: null } },
        include: { vehicle: true, items: true, payments: true },
        orderBy: { number: "asc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo fechamento"
        description="Escolha a loja e a semana. As ordens prontas ou entregues dessa semana já vêm marcadas."
      />
      {error ? <Alert>{error}</Alert> : null}
      <form className="flex flex-wrap items-end gap-2" action="/fechamentos/novo">
        <div className="w-full sm:w-64">
          <Field label="Parceiro">
            <ComboBox
              name="parceiro"
              ariaLabel="Parceiro"
              placeholder="Buscar loja"
              defaultValue={partnerId}
              options={partners.map((partner) => ({ value: partner.id, label: partner.tradeName || partner.name }))}
            />
          </Field>
        </div>
        <Field label="Dia da semana">
          <input name="semana" type="date" defaultValue={weekInput} className="field w-full sm:w-44" />
        </Field>
        <Button type="submit" variant="secondary">
          Ver ordens
        </Button>
      </form>
      {partnerId ? (
        <form action={createSettlement}>
          <input type="hidden" name="partnerId" value={partnerId} />
          <input type="hidden" name="week" value={weekInput} />
          <Panel className="space-y-3">
            <h2 className="font-display text-lg">
              {range.startIso.split("-").reverse().join("/")} a {range.endIso.split("-").reverse().join("/")}
            </h2>
            {orders.length === 0 ? (
              <p className="text-sm text-muted">Não há ordens prontas ou entregues desta loja fora de um fechamento.</p>
            ) : (
              <ul className="divide-y divide-line">
                {orders.map((order) => {
                  const when = order.deliveredAt ?? order.readyAt ?? order.createdAt;
                  const inWeek = isWithin(when, range.start, range.end);
                  const totals = totalsOf(order);
                  return (
                    <li key={order.id} className="flex items-center gap-3 py-2 text-sm">
                      <input type="checkbox" name="orderId" value={order.id} defaultChecked={inWeek} />
                      <span className="min-w-0 flex-1">
                        OS {order.number} · {order.vehicle?.plate ?? "Sem placa"} · {order.vehicle ? `${order.vehicle.brand} ${order.vehicle.model}` : ""}
                      </span>
                      <span className="tabular-nums">{formatBRL(totals.totalCents)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Field label="Observações">
              <input name="notes" className="field" />
            </Field>
            <Button type="submit" disabled={orders.length === 0}>
              Abrir fechamento
            </Button>
          </Panel>
        </form>
      ) : null}
    </div>
  );
}
