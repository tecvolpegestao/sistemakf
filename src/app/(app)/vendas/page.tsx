import type { Metadata } from "next";
import Link from "next/link";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSeeCosts } from "@/lib/domain";
import { formatBRL, formatDate } from "@/lib/format";
import { ButtonLink, Empty, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Vendas" };

export default async function SalesPage() {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const showCosts = canSeeCosts(user.role);
  const sales = await prisma.sale.findMany({
    include: { client: true, items: true, payments: true, createdBy: true },
    orderBy: { number: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Vendas"
        description="Produto vendido fora de uma ordem de serviço. A saída já baixa o estoque."
        actions={<ButtonLink href="/vendas/nova">Nova venda</ButtonLink>}
      />
      {sales.length === 0 ? (
        <Empty title="Nenhuma venda avulsa" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-card text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Venda</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Itens</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                {showCosts ? <th className="px-3 py-2 text-right font-medium">Custo</th> : null}
                <th className="px-3 py-2 font-medium">Situação</th>
                <th className="px-3 py-2 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const total = sale.items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0);
                const cost = sale.items.reduce((sum, item) => sum + item.costCents, 0);
                const paid = sale.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
                const status = sale.status === "CANCELLED" ? "Cancelada" : paid >= total && total > 0 ? "Paga" : paid > 0 ? "Paga em parte" : "Em aberto";
                return (
                  <tr key={sale.id} className="border-t border-line">
                    <td className="px-3 py-3">
                      <Link href={`/vendas/${sale.id}`} className="font-medium text-link">
                        {sale.number}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{sale.client?.name ?? "Balcão"}</td>
                    <td className="px-3 py-3">{sale.items.map((item) => item.name).join(", ")}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatBRL(total)}</td>
                    {showCosts ? <td className="px-3 py-3 text-right tabular-nums">{formatBRL(cost)}</td> : null}
                    <td className="px-3 py-3">{status}</td>
                    <td className="px-3 py-3 tabular-nums text-muted">{formatDate(sale.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
