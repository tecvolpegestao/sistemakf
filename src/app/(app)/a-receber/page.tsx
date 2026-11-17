import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { totalsOf } from "@/lib/domain";
import { daysSince, formatBRL, queryValue, whatsAppUrl } from "@/lib/format";

export const metadata: Metadata = { title: "A receber" };

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<{ ordem?: string }> }) {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const orderBy = queryValue((await searchParams).ordem) === "valor" ? "valor" : "tempo";
  const orders = await prisma.workOrder.findMany({
    where: { status: "DELIVERED", paymentStatus: { not: "PAID" } },
    include: { client: true, vehicle: true, items: true, payments: true },
  });
  const rows = orders
    .map((order) => {
      const totals = totalsOf(order);
      return {
        order,
        balance: totals.balanceCents,
        days: daysSince(order.deliveredAt ?? order.createdAt),
      };
    })
    .filter((row) => row.balance > 0)
    .sort((a, b) => (orderBy === "valor" ? b.balance - a.balance : b.days - a.days));
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.order.clientId;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return (
    <div>
      <PageHeader
        title="A receber"
        description="Ordens entregues que ainda não foram pagas."
        actions={
          <>
            <Link href="/a-receber?ordem=tempo" className={orderBy === "tempo" ? "text-sm text-link" : "text-sm text-muted"}>
              Por tempo
            </Link>
            <Link href="/a-receber?ordem=valor" className={orderBy === "valor" ? "text-sm text-link" : "text-sm text-muted"}>
              Por valor
            </Link>
          </>
        }
      />
      {rows.length === 0 ? (
        <Empty title="Nada em aberto nas entregas" />
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([clientId, items]) => {
            const client = items[0].order.client;
            const total = items.reduce((sum, item) => sum + item.balance, 0);
            const message = `Olá, ${client.name}. Passando para alinhar o pagamento de ${formatBRL(total)} referente aos serviços da KF Detail.`;
            const link = client.phone ? whatsAppUrl(client.phone, message) : null;
            return (
              <section key={clientId} className="rounded-lg border border-line bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-lg">{client.name}</h2>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{formatBRL(total)}</span>
                    {link ? (
                      <a href={link} className="text-sm text-link">
                        Cobrar no WhatsApp
                      </a>
                    ) : null}
                  </div>
                </div>
                <ul className="mt-2 divide-y divide-line text-sm">
                  {items.map((item) => (
                    <li key={item.order.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <Link href={`/os/${item.order.id}`} className="text-link">
                        {item.order.number} · {item.order.vehicle?.plate ?? "Sem placa"}
                      </Link>
                      <span className="text-muted">{item.days} dias</span>
                      <span className="tabular-nums">{formatBRL(item.balance)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
