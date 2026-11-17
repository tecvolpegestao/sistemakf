import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogForm } from "@/components/catalog-form";
import { Button, PageHeader, Panel } from "@/components/ui";
import { requireRoles } from "@/lib/auth";
import { duplicateCatalog, toggleCatalog } from "@/server/catalog-actions";
import { prisma } from "@/lib/db";
import { canSeeCosts, marginRatio } from "@/lib/domain";
import { formatBRL, formatPercent } from "@/lib/format";
import { BILLING_LABEL, TYPE_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Item do catálogo" };

export default async function CatalogItemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const item = await prisma.catalogItem.findUnique({
    where: { id: (await params).id },
    include: { components: true, partner: true },
  });
  if (!item) notFound();
  const owner = canSeeCosts(user.role);
  const [services, partners] = owner
    ? await Promise.all([
        prisma.catalogItem.findMany({
          where: { type: { in: ["LABOR", "MATERIAL_SERVICE"] }, NOT: { id: item.id } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, type: true },
        }),
        prisma.client.findMany({ where: { type: "PARTNER" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.name}
        description={`${TYPE_LABEL[item.type as keyof typeof TYPE_LABEL]} · ${BILLING_LABEL[item.billing as keyof typeof BILLING_LABEL]}`}
      />
      {!owner ? (
        <Panel className="space-y-2 text-sm">
          <p>{item.description || "Sem descrição."}</p>
          <p className="tabular-nums">{formatBRL(item.priceCents)}</p>
          <p>{item.active ? "Ativo" : "Inativo"}</p>
        </Panel>
      ) : (
        <>
          <p className="text-sm text-muted">
            Preço {formatBRL(item.priceCents)}
            {item.costCents > 0
              ? ` · custo ${formatBRL(item.costCents)} · margem ${formatPercent(marginRatio(item.priceCents, item.costCents))}`
              : " · custo ainda não informado"}
            {item.partner ? ` · exclusivo de ${item.partner.name}` : ""}
          </p>
          <div className="flex gap-2">
            <form action={duplicateCatalog}>
              <input type="hidden" name="id" value={item.id} />
              <Button type="submit" variant="secondary">
                Duplicar
              </Button>
            </form>
            <form action={toggleCatalog}>
              <input type="hidden" name="id" value={item.id} />
              <Button type="submit" variant="secondary">
                {item.active ? "Desativar" : "Ativar"}
              </Button>
            </form>
          </div>
          <CatalogForm
            services={services}
            partners={partners}
            item={{ ...item, componentIds: item.components.map((component) => component.componentId) }}
          />
        </>
      )}
    </div>
  );
}
