"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueUnitCost, movementCostCents, parseBRL, parseDecimal, stockPosition, tracksStock } from "@/lib/domain";
import { formatNumber, parseDateInput } from "@/lib/format";
import type { FormState } from "@/lib/types";

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function saveSale(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const raw = formData.get("payload");
  if (typeof raw !== "string") return { error: "Dados inválidos." };
  let payload: {
    clientId?: string;
    notes?: string;
    method?: string;
    received?: boolean;
    lines?: { catalogItemId?: string; quantity?: string; price?: string }[];
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return { error: "Dados inválidos." };
  }
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  if (lines.length === 0) return { error: "Adicione um produto." };
  const catalog = await prisma.catalogItem.findMany({
    where: { id: { in: lines.map((line) => String(line.catalogItemId ?? "")) } },
  });
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const parsed: { catalogItemId: string; name: string; quantity: number; unitPriceCents: number; unit: string; costCentsCatalog: number }[] = [];
  for (const line of lines) {
    const source = byId.get(String(line.catalogItemId ?? ""));
    if (!source || !source.active || !tracksStock(source.type) || source.type !== "RESALE") {
      return { error: "A venda avulsa usa produtos de revenda." };
    }
    const quantity = parseDecimal(String(line.quantity ?? ""));
    const unitPriceCents = parseBRL(String(line.price ?? ""));
    if (quantity === null || quantity <= 0) return { error: `Informe a quantidade de ${source.name}.` };
    if (unitPriceCents === null) return { error: `Informe o preço de ${source.name}.` };
    parsed.push({
      catalogItemId: source.id,
      name: source.name,
      quantity,
      unitPriceCents,
      unit: source.unit,
      costCentsCatalog: source.costCents,
    });
  }
  const clientId = clip(payload.clientId, 40);
  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return { error: "Cliente não encontrado." };
  }
  const method = ["PIX", "CASH", "CARD"].includes(String(payload.method)) ? String(payload.method) : "PIX";
  const notes = clip(payload.notes, 500);

  const prepared: {
    catalogItemId: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    unitCostCents: number;
    costCents: number;
  }[] = [];
  for (const line of parsed) {
    const movements = await prisma.stockMovement.findMany({
      where: { catalogItemId: line.catalogItemId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const position = stockPosition(movements);
    const already = prepared.filter((item) => item.catalogItemId === line.catalogItemId).reduce((sum, item) => sum + item.quantity, 0);
    if (line.quantity + already - position.quantity > 0.0001) {
      return { error: `Estoque insuficiente de ${line.name}. Disponível: ${formatNumber(position.quantity - already)} ${line.unit}.` };
    }
    const unitCostCents = issueUnitCost(position, line.costCentsCatalog);
    prepared.push({
      catalogItemId: line.catalogItemId,
      name: line.name,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      unitCostCents,
      costCents: movementCostCents(line.quantity, unitCostCents),
    });
  }

  const totalCents = prepared.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPriceCents), 0);
  const saleId = await prisma.$transaction(async (tx) => {
    const max = await tx.sale.aggregate({ _max: { number: true } });
    const sale = await tx.sale.create({
      data: {
        number: (max._max.number ?? 0) + 1,
        clientId: clientId || null,
        notes,
        createdById: user.id,
        items: { create: prepared },
        movements: {
          create: prepared.map((line) => ({
            catalogItemId: line.catalogItemId,
            kind: "OUT",
            quantity: line.quantity,
            unitCostCents: line.unitCostCents,
            note: "Venda avulsa",
            createdById: user.id,
          })),
        },
      },
    });
    if (payload.received !== false && totalCents > 0) {
      await tx.payment.create({
        data: {
          saleId: sale.id,
          amountCents: totalCents,
          method,
          paidAt: new Date(),
          recordedById: user.id,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "SALE",
        entity: "Sale",
        entityId: sale.id,
        detail: `Venda ${sale.number}`,
      },
    });
    return sale.id;
  });

  revalidatePath("/vendas");
  revalidatePath("/estoque");
  revalidatePath("/recebimentos");
  redirect(`/vendas/${saleId}`);
}

export async function registerSalePayment(formData: FormData) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const id = clip(formData.get("saleId"), 40);
  const sale = await prisma.sale.findUnique({ where: { id }, include: { items: true, payments: true } });
  if (!sale || sale.status === "CANCELLED") redirect("/vendas");
  const amountCents = parseBRL(clip(formData.get("amount"), 20));
  const method = clip(formData.get("method"), 20);
  if (amountCents === null || amountCents <= 0) redirect(`/vendas/${id}?erro=${encodeURIComponent("Informe o valor recebido.")}`);
  if (!["PIX", "CASH", "CARD"].includes(method)) redirect(`/vendas/${id}?erro=${encodeURIComponent("Forma de pagamento inválida.")}`);
  const total = sale.items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0);
  const paid = sale.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  if (amountCents > total - paid) redirect(`/vendas/${id}?erro=${encodeURIComponent("O valor passa do saldo da venda.")}`);
  const paidAt = parseDateInput(clip(formData.get("paidAt"), 10)) ?? new Date();
  await prisma.payment.create({ data: { saleId: id, amountCents, method, paidAt, recordedById: user.id } });
  revalidatePath("/recebimentos");
  revalidatePath(`/vendas/${id}`);
  redirect(`/vendas/${id}`);
}

export async function cancelSale(formData: FormData) {
  const user = await requireRoles(["OWNER"]);
  const id = clip(formData.get("saleId"), 40);
  const reason = clip(formData.get("reason"), 300);
  if (reason.length < 5) redirect(`/vendas/${id}?erro=${encodeURIComponent("Informe o motivo do cancelamento.")}`);
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale || sale.status === "CANCELLED") redirect("/vendas");
  await prisma.$transaction([
    prisma.stockMovement.deleteMany({ where: { saleId: id } }),
    prisma.payment.deleteMany({ where: { saleId: id } }),
    prisma.sale.update({ where: { id }, data: { status: "CANCELLED", notes: reason } }),
    prisma.auditLog.create({
      data: { userId: user.id, action: "CANCEL", entity: "Sale", entityId: id, detail: reason },
    }),
  ]);
  revalidatePath("/vendas");
  revalidatePath("/estoque");
  revalidatePath("/recebimentos");
  redirect(`/vendas/${id}`);
}
