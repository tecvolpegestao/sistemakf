import type { Metadata } from "next";
import Link from "next/link";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { totalsOf } from "@/lib/domain";
import { formatBRL, formatDate } from "@/lib/format";
import { ButtonLink, Empty, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Fechamentos" };

export default async function SettlementsPage() {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const [settlements, waiting] = await Promise.all([
    prisma.settlement.findMany({
      include: { partner: true, lines: { include: { workOrder: { include: { items: true, payments: true } } } }, payments: true },
      orderBy: { weekStart: "desc" },
    }),
    prisma.workOrder.count({
      where: { client: { type: "PARTNER" }, status: { in: ["READY", "DELIVERED"] }, settlementLine: { is: null } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fechamentos"
        description="A semana de cada loja parceira. Uma ordem entra em um fechamento só."
        actions={<ButtonLink href="/fechamentos/novo">Novo fechamento</ButtonLink>}
      />
      <p className="text-sm text-muted">{waiting} ordens de parceiro prontas ou entregues ainda fora de um fechamento.</p>
      {settlements.length === 0 ? (
        <Empty title="Nenhum fechamento aberto" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-card text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Semana</th>
                <th className="px-3 py-2 font-medium">Parceiro</th>
                <th className="px-3 py-2 text-right font-medium">Ordens</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 text-right font-medium">Saldo</th>
                <th className="px-3 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((settlement) => {
                const total = settlement.lines.reduce((sum, line) => sum + line.amountCents, 0);
                const balance = settlement.lines.reduce((sum, line) => sum + totalsOf(line.workOrder).balanceCents, 0);
                return (
                  <tr key={settlement.id} className="border-t border-line">
                    <td className="px-3 py-3">
                      <Link href={`/fechamentos/${settlement.id}`} className="font-medium text-link">
                        {formatDate(settlement.weekStart)} – {formatDate(settlement.weekEnd)}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{settlement.partner.tradeName || settlement.partner.name}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{settlement.lines.length}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatBRL(total)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatBRL(balance)}</td>
                    <td className="px-3 py-3">{settlement.status === "CLOSED" ? "Encerrado" : "Em aberto"}</td>
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
