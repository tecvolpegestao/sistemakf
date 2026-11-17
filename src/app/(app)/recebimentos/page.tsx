import type { Metadata } from "next";
import Link from "next/link";
import { ComboBox } from "@/components/combo-box";
import { Empty, PageHeader } from "@/components/ui";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dateInput, formatBRL, formatDate, parseDateInput, queryValue, startOfMonth } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Recebimentos" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; method?: string }>;
}) {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const params = await searchParams;
  const fromInput = queryValue(params.from);
  const toInput = queryValue(params.to);
  const method = queryValue(params.method);
  const from = parseDateInput(fromInput) ?? startOfMonth();
  const to = parseDateInput(toInput, true);
  const payments = await prisma.payment.findMany({
    where: {
      paidAt: { gte: from, ...(to ? { lte: to } : {}) },
      ...(method ? { method } : {}),
    },
    include: { recordedBy: true, workOrder: { include: { client: true } }, sale: { include: { client: true } } },
    orderBy: { paidAt: "desc" },
  });
  const total = payments.reduce((sum, payment) => sum + payment.amountCents, 0);

  return (
    <div>
      <PageHeader title="Recebimentos" description="Tudo o que entrou de serviços e pacotes, com a forma e quem registrou." />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input name="from" type="date" defaultValue={fromInput || dateInput(from)} className="field w-full sm:w-44" aria-label="De" />
        <input name="to" type="date" defaultValue={toInput} className="field w-full sm:w-44" aria-label="Até" />
        <div className="w-full sm:w-40">
          <ComboBox
            name="method"
            ariaLabel="Forma"
            placeholder="Todas"
            defaultValue={method}
            options={[{ value: "", label: "Todas" }, ...Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))]}
          />
        </div>
        <button className="button-line" type="submit">
          Filtrar
        </button>
      </form>
      <p className="mb-3 text-sm">
        Total no período: <span className="font-medium tabular-nums">{formatBRL(total)}</span>
      </p>
      {payments.length === 0 ? (
        <Empty title="Nenhum recebimento neste período" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-card text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Origem</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Forma</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-t border-line">
                  <td className="px-3 py-3 tabular-nums">{formatDate(payment.paidAt)}</td>
                  <td className="px-3 py-3">
                    {payment.workOrder ? (
                      <Link href={`/os/${payment.workOrderId}`} className="text-link">
                        OS {payment.workOrder.number}
                      </Link>
                    ) : payment.sale ? (
                      <Link href={`/vendas/${payment.saleId}`} className="text-link">
                        Venda {payment.sale.number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3">{payment.workOrder?.client.name ?? payment.sale?.client?.name ?? (payment.sale ? "Balcão" : "—")}</td>
                  <td className="px-3 py-3">{METHOD_LABEL[payment.method as keyof typeof METHOD_LABEL] ?? payment.method}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatBRL(payment.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
