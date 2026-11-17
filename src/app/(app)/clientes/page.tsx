import type { Metadata } from "next";
import Link from "next/link";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizePhone, normalizePlate, totalsOf } from "@/lib/domain";
import { formatBRL, formatPhone, queryValue } from "@/lib/format";
import { ComboBox } from "@/components/combo-box";
import { ButtonLink, Empty, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const params = await searchParams;
  const q = queryValue(params.q).trim();
  const tipo = queryValue(params.tipo);
  const phone = normalizePhone(q);
  const plate = normalizePlate(q);
  const clients = await prisma.client.findMany({
    where: {
      AND: [
        tipo === "PARTNER" || tipo === "PRIVATE" ? { type: tipo } : {},
        q
          ? {
              OR: [
                { name: { contains: q } },
                ...(phone ? [{ phone: { contains: phone } }] : []),
                ...(plate ? [{ vehicles: { some: { plate: { contains: plate } } } }] : []),
              ],
            }
          : {},
      ],
    },
    include: {
      vehicles: true,
      orders: { where: { status: "DELIVERED" }, include: { items: true, payments: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Particulares e o acesso rápido para a ficha, o veículo e um novo orçamento."
        actions={<ButtonLink href="/clientes/novo">Novo cliente</ButtonLink>}
      />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} className="field w-full sm:max-w-xs" placeholder="Nome, telefone ou placa" aria-label="Buscar cliente" />
        <div className="w-full sm:w-48">
          <ComboBox
            name="tipo"
            ariaLabel="Tipo"
            placeholder="Todos os tipos"
            defaultValue={tipo}
            options={[
              { value: "", label: "Todos os tipos" },
              { value: "PRIVATE", label: "Particular" },
              { value: "PARTNER", label: "Parceiro" },
            ]}
          />
        </div>
        <button className="button-line" type="submit">
          Filtrar
        </button>
      </form>
      {clients.length === 0 ? (
        <Empty title="Nenhum cliente encontrado" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-card text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">Telefone</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Veículos</th>
                <th className="px-3 py-2 text-right font-medium">Em aberto</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const open = client.orders.reduce((sum, order) => sum + totalsOf(order).balanceCents, 0);
                const href = client.type === "PARTNER" ? `/parceiros/${client.id}` : `/clientes/${client.id}`;
                return (
                  <tr key={client.id} className="border-t border-line">
                    <td className="px-3 py-3">
                      <Link href={href} className="font-medium text-link">
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{client.phone ? formatPhone(client.phone) : "—"}</td>
                    <td className="px-3 py-3">{client.type === "PARTNER" ? "Parceiro" : "Particular"}</td>
                    <td className="px-3 py-3 tabular-nums">{client.vehicles.length}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatBRL(open)}</td>
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
