import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ComboBox } from "@/components/combo-box";
import { Alert, Button, Field, PageHeader, Panel } from "@/components/ui";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSeeCosts, marginRatio, totalsOf } from "@/lib/domain";
import { centsToInput, formatBRL, formatDate, formatPercent, queryValue, todayInput } from "@/lib/format";
import { consumptionCost } from "@/lib/inventory";
import { METHOD_LABEL } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { addSettlementOrder, closeSettlement, registerSettlementPayment, removeSettlementOrder } from "@/server/settlement-actions";

export const metadata: Metadata = { title: "Fechamento" };

export default async function SettlementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const error = queryValue((await searchParams).erro);
  const settlement = await prisma.settlement.findUnique({
    where: { id: (await params).id },
    include: {
      partner: true,
      createdBy: true,
      lines: {
        include: {
          workOrder: {
            include: { vehicle: true, items: true, payments: true, movements: true },
          },
        },
        orderBy: { workOrder: { number: "asc" } },
      },
    },
  });
  if (!settlement) notFound();
  const showCosts = canSeeCosts(user.role);
  const settings = await getSettings();
  const open = settlement.status === "OPEN";
  const available = open
    ? await prisma.workOrder.findMany({
        where: {
          clientId: settlement.partnerId,
          status: { in: ["READY", "DELIVERED"] },
          settlementLine: { is: null },
        },
        include: { vehicle: true },
        orderBy: { number: "asc" },
      })
    : [];
  const total = settlement.lines.reduce((sum, line) => sum + line.amountCents, 0);
  const balance = settlement.lines.reduce((sum, line) => sum + totalsOf(line.workOrder).balanceCents, 0);
  const realCost = settlement.lines.reduce(
    (sum, line) => sum + line.workOrder.movements.filter((movement) => movement.kind === "OUT").reduce((inner, movement) => inner + consumptionCost(movement.quantity, movement.unitCostCents), 0),
    0,
  );
  const estimated = settlement.lines.reduce((sum, line) => sum + line.workOrder.items.reduce((inner, item) => inner + item.costCents, 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={settlement.partner.tradeName || settlement.partner.name}
        description={`${formatDate(settlement.weekStart)} a ${formatDate(settlement.weekEnd)} · ${open ? "Em aberto" : "Encerrado"}`}
      />
      {error ? <Alert>{error}</Alert> : null}
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm text-muted">Valor das ordens</div>
            <div className="font-display text-2xl tabular-nums">{formatBRL(total)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted">Saldo</div>
            <div className="font-display text-2xl tabular-nums">{formatBRL(balance)}</div>
          </div>
        </div>
        {settings.pixKey ? <p className="mt-3 text-sm">Pix da KF: {settings.pixKey}</p> : null}
        {settlement.notes ? <p className="mt-2 text-sm text-muted">{settlement.notes}</p> : null}
        <p className="mt-2 text-xs text-muted">Aberto por {settlement.createdBy.name}.</p>
      </Panel>
      <Panel>
        <h2 className="font-display text-lg">Ordens</h2>
        <ul className="mt-2 divide-y divide-line">
          {settlement.lines.map((line) => {
            const order = line.workOrder;
            return (
              <li key={line.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/os/${order.id}`} className="min-w-0 text-link">
                  OS {order.number} · {order.vehicle?.plate ?? "Sem placa"} {order.vehicle ? `· ${order.vehicle.model}` : ""}
                </Link>
                <span className="tabular-nums">{formatBRL(line.amountCents)}</span>
                {open ? (
                  <form action={removeSettlementOrder}>
                    <input type="hidden" name="lineId" value={line.id} />
                    <button type="submit" className="text-muted">
                      Tirar
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
          {settlement.lines.length === 0 ? <li className="py-2 text-sm text-muted">Nenhuma ordem incluída.</li> : null}
        </ul>
      </Panel>
      {showCosts ? (
        <Panel>
          <h2 className="font-display text-lg">Custo</h2>
          <p className="mt-2 text-sm">Estimado {estimated > 0 ? formatBRL(estimated) : "ainda não informado"}.</p>
          <p className="mt-1 text-sm">
            Real {realCost > 0 ? formatBRL(realCost) : "sem consumo lançado"} · margem{" "}
            {realCost > 0 ? formatPercent(marginRatio(total, realCost)) : "—"}
          </p>
        </Panel>
      ) : null}
      {open && available.length > 0 ? (
        <Panel>
          <h2 className="font-display text-lg">Incluir ordem</h2>
          <form action={addSettlementOrder} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="hidden" name="settlementId" value={settlement.id} />
            <div className="min-w-0 flex-1">
              <Field label="Ordem">
                <ComboBox
                  name="orderId"
                  ariaLabel="Ordem"
                  placeholder="Buscar placa ou número"
                  options={available.map((order) => ({
                    value: order.id,
                    label: `OS ${order.number} · ${order.vehicle?.plate ?? "sem placa"} ${order.vehicle?.model ?? ""}`,
                  }))}
                />
              </Field>
            </div>
            <Button type="submit" variant="secondary">
              Incluir
            </Button>
          </form>
        </Panel>
      ) : null}
      {balance > 0 ? (
        <Panel>
          <h2 className="font-display text-lg">Recebimento</h2>
          <p className="mt-1 text-sm text-muted">O valor é distribuído nas ordens, da mais antiga para a mais nova, até cobrir o saldo de cada uma.</p>
          <form action={registerSettlementPayment} className="mt-3 grid items-end gap-3 sm:grid-cols-4">
            <input type="hidden" name="settlementId" value={settlement.id} />
            <Field label="Valor">
              <input name="amount" className="field" defaultValue={centsToInput(balance)} />
            </Field>
            <Field label="Forma">
              <ComboBox
                name="method"
                ariaLabel="Forma de pagamento"
                defaultValue="PIX"
                options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="Data">
              <input name="paidAt" type="date" className="field" defaultValue={todayInput()} />
            </Field>
            <Button type="submit">Registrar</Button>
          </form>
        </Panel>
      ) : null}
      {open ? (
        <form action={closeSettlement}>
          <input type="hidden" name="settlementId" value={settlement.id} />
          <Button type="submit" variant="secondary">
            Encerrar semana
          </Button>
        </form>
      ) : null}
    </div>
  );
}
