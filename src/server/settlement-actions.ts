"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { allocateAmount, parseBRL, totalsOf } from "@/lib/domain";
import { parseDateInput, weekRange } from "@/lib/format";

function clip(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function fail(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

const BILLABLE = ["READY", "DELIVERED"];

export async function createSettlement(formData: FormData) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const partnerId = clip(formData.get("partnerId"), 40);
  const anchor = parseDateInput(clip(formData.get("week"), 10)) ?? new Date();
  const notes = clip(formData.get("notes"), 500);
  const orderIds = formData.getAll("orderId").map((value) => String(value)).filter(Boolean);
  const partner = await prisma.client.findFirst({ where: { id: partnerId, type: "PARTNER" } });
  if (!partner) fail("/fechamentos/novo", "Escolha a loja parceira.");
  if (orderIds.length === 0) fail("/fechamentos/novo", "Selecione ao menos uma ordem.");
  const range = weekRange(anchor);
  const orders = await prisma.workOrder.findMany({
    where: { id: { in: orderIds }, clientId: partner.id, status: { in: BILLABLE }, settlementLine: { is: null } },
    include: { items: true, payments: true },
  });
  if (orders.length !== orderIds.length) fail("/fechamentos/novo", "Alguma ordem já entrou em outro fechamento ou não é desta loja.");
  const settlement = await prisma.settlement.create({
    data: {
      partnerId: partner.id,
      weekStart: range.start,
      weekEnd: range.end,
      notes,
      createdById: user.id,
      lines: {
        create: orders.map((order) => ({
          workOrderId: order.id,
          amountCents: totalsOf(order).totalCents,
        })),
      },
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "SETTLEMENT",
      entity: "Settlement",
      entityId: settlement.id,
      detail: `${partner.name}: ${orders.length} ordens`,
    },
  });
  revalidatePath("/fechamentos");
  redirect(`/fechamentos/${settlement.id}`);
}

export async function addSettlementOrder(formData: FormData) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const id = clip(formData.get("settlementId"), 40);
  const orderId = clip(formData.get("orderId"), 40);
  const settlement = await prisma.settlement.findUnique({ where: { id } });
  if (!settlement || settlement.status !== "OPEN") fail(`/fechamentos/${id}`, "Este fechamento já foi encerrado.");
  const order = await prisma.workOrder.findUnique({
    where: { id: orderId },
    include: { items: true, payments: true, settlementLine: true },
  });
  if (!order || order.clientId !== settlement.partnerId || !BILLABLE.includes(order.status) || order.settlementLine) {
    fail(`/fechamentos/${id}`, "Essa ordem não pode entrar neste fechamento.");
  }
  await prisma.settlementLine.create({
    data: { settlementId: id, workOrderId: order.id, amountCents: totalsOf(order).totalCents },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "SETTLEMENT", entity: "Settlement", entityId: id, detail: `Incluiu OS ${order.number}` },
  });
  revalidatePath(`/fechamentos/${id}`);
  redirect(`/fechamentos/${id}`);
}

export async function removeSettlementOrder(formData: FormData) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const lineId = clip(formData.get("lineId"), 40);
  const line = await prisma.settlementLine.findUnique({
    where: { id: lineId },
    include: { settlement: true, workOrder: { include: { payments: true } } },
  });
  if (!line) redirect("/fechamentos");
  if (line.settlement.status !== "OPEN") fail(`/fechamentos/${line.settlementId}`, "Este fechamento já foi encerrado.");
  const tied = line.workOrder.payments.some((payment) => payment.settlementId === line.settlementId);
  if (tied) fail(`/fechamentos/${line.settlementId}`, "Esta ordem já recebeu valor deste fechamento.");
  await prisma.settlementLine.delete({ where: { id: line.id } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "SETTLEMENT",
      entity: "Settlement",
      entityId: line.settlementId,
      detail: `Removeu OS ${line.workOrder.number}`,
    },
  });
  revalidatePath(`/fechamentos/${line.settlementId}`);
  redirect(`/fechamentos/${line.settlementId}`);
}

export async function closeSettlement(formData: FormData) {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const id = clip(formData.get("settlementId"), 40);
  const settlement = await prisma.settlement.findUnique({ where: { id }, include: { lines: true } });
  if (!settlement) redirect("/fechamentos");
  if (settlement.lines.length === 0) fail(`/fechamentos/${id}`, "Inclua ao menos uma ordem antes de encerrar.");
  await prisma.settlement.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } });
  revalidatePath("/fechamentos");
  redirect(`/fechamentos/${id}`);
}

export async function registerSettlementPayment(formData: FormData) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const id = clip(formData.get("settlementId"), 40);
  const amountCents = parseBRL(clip(formData.get("amount"), 20));
  const method = clip(formData.get("method"), 20);
  const paidAt = parseDateInput(clip(formData.get("paidAt"), 10)) ?? new Date();
  if (amountCents === null || amountCents <= 0) fail(`/fechamentos/${id}`, "Informe o valor recebido.");
  if (!["PIX", "CASH", "CARD"].includes(method)) fail(`/fechamentos/${id}`, "Forma de pagamento inválida.");
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: { lines: { include: { workOrder: { include: { items: true, payments: true } } }, orderBy: { workOrder: { number: "asc" } } } },
  });
  if (!settlement) redirect("/fechamentos");
  const balances = settlement.lines.map((line) => ({
    id: line.workOrderId,
    balanceCents: totalsOf(line.workOrder).balanceCents,
    number: line.workOrder.number,
  }));
  const open = balances.reduce((sum, row) => sum + row.balanceCents, 0);
  if (amountCents > open) fail(`/fechamentos/${id}`, "O valor passa do saldo das ordens deste fechamento.");
  const allocation = allocateAmount(balances, amountCents);
  await prisma.$transaction(async (tx) => {
    for (const part of allocation.parts) {
      await tx.payment.create({
        data: {
          workOrderId: part.id,
          settlementId: id,
          amountCents: part.amountCents,
          method,
          paidAt,
          notes: "Fechamento semanal",
          recordedById: user.id,
        },
      });
      const order = settlement.lines.find((line) => line.workOrderId === part.id)!.workOrder;
      const next = totalsOf({
        ...order,
        payments: [...order.payments, { amountCents: part.amountCents }],
      });
      await tx.workOrder.update({ where: { id: part.id }, data: { paymentStatus: next.paymentStatus } });
      await tx.orderEvent.create({
        data: {
          workOrderId: part.id,
          userId: user.id,
          message: `${user.name} registrou o recebimento do fechamento semanal.`,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "PAYMENT",
        entity: "Settlement",
        entityId: id,
        detail: `${amountCents} ${method}`,
      },
    });
  });
  revalidatePath("/recebimentos");
  revalidatePath("/a-receber");
  revalidatePath(`/fechamentos/${id}`);
  redirect(`/fechamentos/${id}`);
}
