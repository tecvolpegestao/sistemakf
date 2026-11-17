"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoles, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManage, issueUnitCost, parseBRL, parseDecimal, stockPosition, tracksStock } from "@/lib/domain";
import { formatNumber } from "@/lib/format";

function clip(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function fail(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

async function positionOf(catalogItemId: string) {
  const movements = await prisma.stockMovement.findMany({
    where: { catalogItemId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return stockPosition(movements);
}

export async function receiveStock(formData: FormData) {
  const user = await requireRoles(["OWNER"]);
  const catalogItemId = clip(formData.get("catalogItemId"), 40);
  const quantity = parseDecimal(clip(formData.get("quantity"), 20));
  const costRaw = clip(formData.get("unitCost"), 20);
  const note = clip(formData.get("note"), 300);
  const item = await prisma.catalogItem.findUnique({ where: { id: catalogItemId } });
  if (!item || !tracksStock(item.type)) fail("/estoque", "Escolha um produto ou serviço com material.");
  if (quantity === null || quantity <= 0) fail("/estoque", "Informe a quantidade que entrou.");
  const unitCostCents = costRaw ? parseBRL(costRaw) : item.costCents;
  if (unitCostCents === null) fail("/estoque", "Custo inválido.");
  await prisma.stockMovement.create({
    data: {
      catalogItemId: item.id,
      kind: "IN",
      quantity,
      unitCostCents,
      note,
      createdById: user.id,
    },
  });
  const next = await positionOf(item.id);
  await prisma.$transaction([
    prisma.catalogItem.update({
      where: { id: item.id },
      data: { costCents: next.averageCostCents || unitCostCents },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "STOCK_IN",
        entity: "CatalogItem",
        entityId: item.id,
        detail: `${item.name}: +${quantity} ${item.unit}`,
      },
    }),
  ]);
  revalidatePath("/estoque");
  revalidatePath("/catalogo");
  redirect("/estoque");
}

export async function adjustStock(formData: FormData) {
  const user = await requireRoles(["OWNER"]);
  const catalogItemId = clip(formData.get("catalogItemId"), 40);
  const target = parseDecimal(clip(formData.get("quantity"), 20));
  const note = clip(formData.get("note"), 300);
  if (note.length < 5) fail("/estoque", "Informe o motivo do ajuste.");
  const item = await prisma.catalogItem.findUnique({ where: { id: catalogItemId } });
  if (!item || !tracksStock(item.type)) fail("/estoque", "Escolha um produto ou serviço com material.");
  if (target === null || target < 0) fail("/estoque", "Informe a quantidade correta.");
  const current = await positionOf(item.id);
  const delta = Math.round((target - current.quantity) * 1000) / 1000;
  if (Math.abs(delta) < 0.0001) fail("/estoque", "A quantidade informada já é o saldo.");
  await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        catalogItemId: item.id,
        kind: "ADJUST",
        quantity: delta,
        unitCostCents: current.averageCostCents || item.costCents,
        note,
        createdById: user.id,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "STOCK_ADJUST",
        entity: "CatalogItem",
        entityId: item.id,
        detail: `${item.name}: ${formatNumber(current.quantity)} → ${formatNumber(target)}. ${note}`,
      },
    }),
  ]);
  revalidatePath("/estoque");
  redirect("/estoque");
}

export async function recordConsumption(formData: FormData) {
  const user = await requireUser();
  const orderId = clip(formData.get("orderId"), 40);
  const catalogItemId = clip(formData.get("catalogItemId"), 40);
  const quantity = parseDecimal(clip(formData.get("quantity"), 20));
  const note = clip(formData.get("note"), 300);
  const order = await prisma.workOrder.findUnique({ where: { id: orderId } });
  if (!order) redirect("/os");
  if (user.role === "APPLICATOR" && order.assignedToId !== user.id) redirect("/os");
  if (!canManage(user.role) && user.role !== "APPLICATOR") redirect("/os");
  if (["CANCELLED", "REFUSED"].includes(order.status)) fail(`/os/${orderId}`, "Esta ordem não recebe consumo.");
  const item = await prisma.catalogItem.findUnique({ where: { id: catalogItemId } });
  if (!item || !tracksStock(item.type)) fail(`/os/${orderId}`, "Escolha um item de estoque.");
  if (quantity === null || quantity <= 0) fail(`/os/${orderId}`, "Informe a quantidade usada.");
  const current = await positionOf(item.id);
  if (quantity - current.quantity > 0.0001) {
    fail(`/os/${orderId}`, `Estoque insuficiente de ${item.name}. Disponível: ${formatNumber(current.quantity)} ${item.unit}.`);
  }
  const unitCostCents = issueUnitCost(current, item.costCents);
  await prisma.stockMovement.create({
    data: {
      catalogItemId: item.id,
      kind: "OUT",
      quantity,
      unitCostCents,
      workOrderId: order.id,
      note,
      createdById: user.id,
    },
  });
  await prisma.orderEvent.create({
    data: {
      workOrderId: order.id,
      userId: user.id,
      message: `${user.name} registrou o consumo de ${formatNumber(quantity)} ${item.unit} de ${item.name}.`,
    },
  });
  revalidatePath(`/os/${orderId}`);
  revalidatePath("/estoque");
  redirect(`/os/${orderId}`);
}

export async function removeConsumption(formData: FormData) {
  const user = await requireRoles(["OWNER"]);
  const movementId = clip(formData.get("movementId"), 40);
  const movement = await prisma.stockMovement.findUnique({ where: { id: movementId }, include: { catalogItem: true } });
  if (!movement || movement.kind !== "OUT" || !movement.workOrderId) redirect("/os");
  await prisma.stockMovement.delete({ where: { id: movement.id } });
  await prisma.orderEvent.create({
    data: {
      workOrderId: movement.workOrderId,
      userId: user.id,
      message: `${user.name} removeu o consumo de ${formatNumber(movement.quantity)} ${movement.catalogItem.unit} de ${movement.catalogItem.name}.`,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "STOCK_ADJUST",
      entity: "WorkOrder",
      entityId: movement.workOrderId,
      detail: `Removeu consumo de ${movement.catalogItem.name}`,
    },
  });
  revalidatePath(`/os/${movement.workOrderId}`);
  revalidatePath("/estoque");
  redirect(`/os/${movement.workOrderId}`);
}
