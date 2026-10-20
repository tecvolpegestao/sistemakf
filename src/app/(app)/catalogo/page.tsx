import type { Metadata } from "next";
import Link from "next/link";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSeeCosts, marginRatio } from "@/lib/domain";
import { formatBRL, formatPercent, queryValue } from "@/lib/format";
import { BILLING_LABEL, TYPE_LABEL } from "@/lib/labels";
import { ButtonLink, Empty, PageHeader } from "@/components/ui";
import { ServiceIcon } from "@/components/service-icon";

export const metadata: Metadata = { title: "Catálogo" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; inativos?: string }>;
}) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const params = await searchParams;
  const q = queryValue(params.q).trim();
  const tipo = queryValue(params.tipo);
  const showInactive = queryValue(params.inativos) === "1";
  const showCosts = canSeeCosts(user.role);
  const items = await prisma.catalogItem.findMany({
    where: {
      AND: [
        showInactive ? {} : { active: true },
        tipo ? { type: tipo } : {},
        q ? { name: { contains: q } } : {},
      ],
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Catálogo"
        description="Serviços, pacotes e produtos. O pacote da Auto Gallery está em R$ 500; os demais preços são um ponto de partida para ajustar."
        actions={showCosts ? <ButtonLink href="/catalogo/novo">Novo item</ButtonLink> : undefined}
      />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input name="q" defaultValue={q} className="field sm:max-w-xs" placeholder="Nome" aria-label="Buscar item" />
        <select name="tipo" defaultValue={tipo} className="field sm:w-56" aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="inativos" value="1" defaultChecked={showInactive} />
          Incluir inativos
        </label>
        <button className="rounded-md border border-line bg-card px-3 py-2 text-sm" type="submit">
          Filtrar
        </button>
      </form>
      {items.length === 0 ? (
        <Empty title="Nenhum item neste filtro" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-card text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Cobrança</th>
                <th className="px-3 py-2 text-right font-medium">Preço</th>
                {showCosts ? <th className="px-3 py-2 text-right font-medium">Custo</th> : null}
                {showCosts ? <th className="px-3 py-2 text-right font-medium">Margem</th> : null}
                <th className="px-3 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-3 py-3">
                    <Link href={`/catalogo/${item.id}`} className="inline-flex items-center gap-2 font-medium text-link">
                      <ServiceIcon name={item.icon} />
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{TYPE_LABEL[item.type as keyof typeof TYPE_LABEL] ?? item.type}</td>
                  <td className="px-3 py-3">{BILLING_LABEL[item.billing as keyof typeof BILLING_LABEL] ?? item.billing}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatBRL(item.priceCents)}
                    {item.billing === "PER_METER" ? " / m" : ""}
                  </td>
                  {showCosts ? (
                    <td className="px-3 py-3 text-right tabular-nums">{item.costCents > 0 ? formatBRL(item.costCents) : "—"}</td>
                  ) : null}
                  {showCosts ? (
                    <td className="px-3 py-3 text-right tabular-nums">
                      {item.costCents > 0 ? formatPercent(marginRatio(item.priceCents, item.costCents)) : "—"}
                    </td>
                  ) : null}
                  <td className="px-3 py-3">{item.active ? "Ativo" : "Inativo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
