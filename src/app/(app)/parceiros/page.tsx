import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Empty, PageHeader } from "@/components/ui";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { totalsOf } from "@/lib/domain";
import { formatBRL, formatPhone } from "@/lib/format";

export const metadata: Metadata = { title: "Parceiros" };

export default async function PartnersPage() {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const partners = await prisma.client.findMany({
    where: { type: "PARTNER" },
    include: {
      vehicles: true,
      packages: { where: { active: true } },
      orders: { where: { status: "DELIVERED" }, include: { items: true, payments: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Parceiros"
        description="Lojas e frotas com pacote e preço combinados. O fechamento semanal entra na fase seguinte."
        actions={<ButtonLink href="/parceiros/novo">Novo parceiro</ButtonLink>}
      />
      {partners.length === 0 ? (
        <Empty title="Nenhum parceiro cadastrado" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {partners.map((partner) => {
            const open = partner.orders.reduce((sum, order) => sum + totalsOf(order).balanceCents, 0);
            return (
              <Link key={partner.id} href={`/parceiros/${partner.id}`} className="rounded-lg border border-line bg-card p-4 hover:border-ink/30">
                <div className="font-display text-lg">{partner.name}</div>
                <p className="mt-1 text-sm text-muted">{partner.phone ? formatPhone(partner.phone) : "Sem telefone"}</p>
                <p className="mt-3 text-sm">
                  {partner.packages.map((item) => `${item.name} · ${formatBRL(item.priceCents)}`).join(" · ") || "Sem pacote exclusivo"}
                </p>
                <p className="mt-2 text-sm tabular-nums text-muted">
                  {partner.vehicles.length} veículos · {formatBRL(open)} em aberto
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
