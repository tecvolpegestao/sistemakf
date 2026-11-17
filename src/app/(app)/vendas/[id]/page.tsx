import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ComboBox } from "@/components/combo-box";
import { Alert, Button, Field, PageHeader, Panel } from "@/components/ui";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSeeCosts } from "@/lib/domain";
import { centsToInput, formatBRL, formatDate, formatNumber, queryValue, todayInput } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/labels";
import { cancelSale, registerSalePayment } from "@/server/sale-actions";

export const metadata: Metadata = { title: "Venda" };

export default async function SalePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const error = queryValue((await searchParams).erro);
  const sale = await prisma.sale.findUnique({
    where: { id: (await params).id },
    include: { client: true, items: true, payments: { include: { recordedBy: true }, orderBy: { paidAt: "desc" } }, createdBy: true },
  });
  if (!sale) notFound();
  const showCosts = canSeeCosts(user.role);
  const total = sale.items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0);
  const cost = sale.items.reduce((sum, item) => sum + item.costCents, 0);
  const paid = sale.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const balance = Math.max(0, total - paid);
  const cancelled = sale.status === "CANCELLED";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Venda ${sale.number}`}
        description={sale.client ? sale.client.name : "Venda de balcão"}
        actions={
          sale.client ? (
            <Link href={`/clientes/${sale.client.id}`} className="text-sm text-link">
              Abrir cliente
            </Link>
          ) : undefined
        }
      />
      {error ? <Alert>{error}</Alert> : null}
      {cancelled ? <Alert>Cancelada. O estoque desta venda voltou.</Alert> : null}
      <Panel>
        <ul className="divide-y divide-line text-sm">
          {sale.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                {item.name} · {formatNumber(item.quantity)}
              </span>
              <span className="tabular-nums">{formatBRL(Math.round(item.quantity * item.unitPriceCents))}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-muted">Total</span>
          <span className="font-display text-2xl tabular-nums">{formatBRL(total)}</span>
        </div>
        {showCosts ? (
          <p className="mt-2 text-xs text-muted">
            Custo {formatBRL(cost)} · margem {total > 0 ? `${Math.round(((total - cost) / total) * 1000) / 10}%` : "—"}
          </p>
        ) : null}
        {sale.notes ? <p className="mt-3 text-sm text-muted">{sale.notes}</p> : null}
        <p className="mt-3 text-xs text-muted">
          Registrada por {sale.createdBy.name} em {formatDate(sale.createdAt)}.
        </p>
      </Panel>
      {!cancelled && balance > 0 ? (
        <Panel>
          <h2 className="font-display text-lg">Pagamento</h2>
          <p className="mt-1 text-sm text-muted">Saldo {formatBRL(balance)}</p>
          <form action={registerSalePayment} className="mt-3 grid items-end gap-3 sm:grid-cols-4">
            <input type="hidden" name="saleId" value={sale.id} />
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
      {sale.payments.length > 0 ? (
        <Panel>
          <h2 className="font-display text-lg">Recebimentos</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {sale.payments.map((payment) => (
              <li key={payment.id} className="flex justify-between gap-3 py-2">
                <span>
                  {formatDate(payment.paidAt)} · {METHOD_LABEL[payment.method as keyof typeof METHOD_LABEL] ?? payment.method} · {payment.recordedBy.name}
                </span>
                <span className="tabular-nums">{formatBRL(payment.amountCents)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      {showCosts && !cancelled ? (
        <Panel>
          <h2 className="font-display text-lg">Cancelar</h2>
          <p className="mt-1 text-sm text-muted">Devolve os produtos ao estoque e retira os recebimentos desta venda.</p>
          <form action={cancelSale} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input type="hidden" name="saleId" value={sale.id} />
            <input name="reason" className="field" placeholder="Motivo" required minLength={5} />
            <Button type="submit" variant="danger">
              Cancelar venda
            </Button>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
