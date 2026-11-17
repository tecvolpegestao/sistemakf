"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRoles, requireUser } from "@/lib/auth";
import {
  asStatus,
  availableTransitions,
  canManage,
  isValidPlate,
  lineCostCents,
  normalizePhone,
  normalizePlate,
  packageCostCents,
  parseBRL,
  parseDraftItem,
  totalsOf,
} from "@/lib/domain";
import { parseDateInput } from "@/lib/format";
import { removePublicFile, saveImage } from "@/lib/images";
import { STATUS_ACTION } from "@/lib/labels";
import type { DraftItemInput, OrderFormState, ServiceStatus } from "@/lib/types";

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function fail(id: string, message: string): never {
  redirect(`/os/${id}?erro=${encodeURIComponent(message)}`);
}

export async function saveOrder(_prev: OrderFormState, formData: FormData): Promise<OrderFormState> {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const raw = formData.get("payload");
  if (typeof raw !== "string") return { error: "Dados inválidos." };
  let payload: {
    orderId?: string | null;
    clientId?: string | null;
    newClient?: { name?: string; phone?: string; email?: string; type?: string } | null;
    vehicleId?: string | null;
    newVehicle?: { plate?: string; brand?: string; model?: string; year?: string; color?: string } | null;
    confirmPhone?: boolean;
    items?: DraftItemInput[];
    discount?: string;
    notes?: string;
    assignedToId?: string;
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return { error: "Dados inválidos." };
  }

  const existingOrder = payload.orderId
    ? await prisma.workOrder.findUnique({ where: { id: payload.orderId }, include: { items: true, payments: true, steps: true } })
    : null;
  if (payload.orderId && !existingOrder) return { error: "Ordem não encontrada." };
  if (existingOrder && ["CANCELLED", "REFUSED"].includes(existingOrder.status)) {
    return { error: "Esta ordem não pode ser alterada." };
  }
  if (existingOrder && !["QUOTE", "AWAITING_APPROVAL"].includes(existingOrder.status) && user.role !== "OWNER") {
    return { error: "Depois da aprovação, só o dono altera o orçamento." };
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) return { error: "Adicione pelo menos um item." };
  const catalog = await prisma.catalogItem.findMany({
    where: { id: { in: items.map((item) => item.catalogItemId) } },
    include: { components: { include: { component: true } } },
  });
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const parsed: { catalogItemId: string; quantity: number; meters: number | null; unitPriceCents: number }[] = [];
  for (const rawItem of items) {
    const item: DraftItemInput = {
      catalogItemId: String(rawItem.catalogItemId ?? ""),
      quantity: String(rawItem.quantity ?? ""),
      meters: String(rawItem.meters ?? ""),
      price: String(rawItem.price ?? ""),
    };
    const source = catalogById.get(item.catalogItemId);
    if (!source || source.type === "RESALE") return { error: "Há um item de catálogo indisponível neste orçamento." };
    if (!source.active && !existingOrder?.items.some((line) => line.catalogItemId === source.id)) {
      return { error: `${source.name} está inativo.` };
    }
    const result = parseDraftItem(item, source.billing);
    if (!result.ok) return { error: result.error };
    parsed.push({ catalogItemId: source.id, ...result.value });
  }

  const discountRaw = clip(payload.discount, 20);
  const discountCents = discountRaw ? parseBRL(discountRaw) : 0;
  if (discountCents === null) return { error: "Desconto inválido." };
  const notes = clip(payload.notes, 2000);
  const assignedToId = clip(payload.assignedToId, 40);
  if (assignedToId) {
    const assignee = await prisma.user.findFirst({ where: { id: assignedToId, role: "APPLICATOR", active: true } });
    if (!assignee) return { error: "Aplicador não encontrado." };
  }

  let clientId = clip(payload.clientId, 40);
  let newClient: { name: string; phone: string; email: string; type: string } | null = null;
  if (!clientId) {
    const name = clip(payload.newClient?.name, 120);
    const phone = normalizePhone(clip(payload.newClient?.phone, 30));
    const email = clip(payload.newClient?.email, 120).toLowerCase();
    const type = payload.newClient?.type === "PARTNER" ? "PARTNER" : "PRIVATE";
    if (name.length < 2) return { error: "Informe o nome do cliente." };
    if (phone && phone.length < 10) return { error: "Telefone incompleto." };
    if (phone) {
      const duplicatePhone = await prisma.client.findFirst({ where: { phone } });
      if (duplicatePhone && !payload.confirmPhone) {
        return {
          error: `Já existe um cliente com este telefone: ${duplicatePhone.name}.`,
          code: "DUPLICATE_PHONE",
        };
      }
    }
    newClient = { name, phone, email, type };
  } else {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return { error: "Cliente não encontrado." };
  }

  let vehicleId = clip(payload.vehicleId, 40);
  let newVehicle: { plate: string; brand: string; model: string; year: number | null; color: string } | null = null;
  if (!vehicleId) {
    const plate = normalizePlate(clip(payload.newVehicle?.plate, 12));
    const brand = clip(payload.newVehicle?.brand, 60);
    const model = clip(payload.newVehicle?.model, 60);
    const color = clip(payload.newVehicle?.color, 40);
    const yearRaw = clip(payload.newVehicle?.year, 4);
    const year = yearRaw ? Number(yearRaw) : null;
    if (!isValidPlate(plate)) return { error: "Placa inválida." };
    if (!brand || !model) return { error: "Informe marca e modelo." };
    if (year !== null && (!Number.isInteger(year) || year < 1950 || year > 2100)) return { error: "Ano inválido." };
    const duplicatePlate = await prisma.vehicle.findFirst({ where: { plate }, include: { client: true } });
    if (duplicatePlate) {
      return {
        error: `A placa ${plate} já está com ${duplicatePlate.client.name}.`,
        code: "DUPLICATE_PLATE",
        existingHref: `/veiculos/${duplicatePlate.id}`,
        existingLabel: `${plate} · ${duplicatePlate.client.name}`,
        existingVehicleId: duplicatePlate.clientId === clientId ? duplicatePlate.id : undefined,
      };
    }
    newVehicle = { plate, brand, model, year, color };
  }

  const lines = parsed.map((item, index) => {
    const source = catalogById.get(item.catalogItemId)!;
    const unitCost =
      source.type === "PACKAGE"
        ? packageCostCents(source.components.map((component) => component.component.costCents))
        : source.costCents;
    return {
      catalogItemId: source.id,
      name: source.name,
      description: source.description,
      icon: source.icon,
      type: source.type,
      billing: source.billing,
      quantity: item.quantity,
      meters: item.meters,
      unitPriceCents: item.unitPriceCents,
      costCents: lineCostCents(source.billing, item.quantity, item.meters, unitCost),
      sortOrder: index,
    };
  });
  const stepNames = uniqueStepNames(parsed.map((item) => item.catalogItemId), catalogById);
  const preview = totalsOf({ discountCents, items: lines, payments: existingOrder?.payments ?? [] });

  const orderId = await prisma.$transaction(async (tx) => {
    if (newClient) {
      const created = await tx.client.create({ data: newClient });
      clientId = created.id;
    }
    if (vehicleId) {
      const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle || vehicle.clientId !== clientId) throw new Error("VEHICLE");
    } else if (newVehicle) {
      const created = await tx.vehicle.create({ data: { ...newVehicle, clientId } });
      vehicleId = created.id;
    }
    if (existingOrder) {
      await tx.workOrderItem.deleteMany({ where: { workOrderId: existingOrder.id } });
      await tx.workOrder.update({
        where: { id: existingOrder.id },
        data: {
          clientId,
          vehicleId,
          discountCents: preview.discountCents,
          notes,
          paymentStatus: preview.paymentStatus,
          assignedToId: assignedToId || null,
          items: { create: lines },
          events: { create: { userId: user.id, message: `${user.name} atualizou o orçamento.` } },
        },
      });
      await replaceSteps(tx, existingOrder.id, stepNames, existingOrder.steps);
      if (!["QUOTE", "AWAITING_APPROVAL"].includes(existingOrder.status)) {
        const before = totalsOf(existingOrder);
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "ORDER_CHANGE",
            entity: "WorkOrder",
            entityId: existingOrder.id,
            detail: `Total ${before.totalCents} -> ${preview.totalCents}`,
          },
        });
      }
      return existingOrder.id;
    }
    const max = await tx.workOrder.aggregate({ _max: { number: true } });
    const created = await tx.workOrder.create({
      data: {
        number: (max._max.number ?? 1000) + 1,
        clientId,
        vehicleId,
        discountCents: preview.discountCents,
        notes,
        paymentStatus: preview.paymentStatus,
        createdById: user.id,
        assignedToId: assignedToId || null,
        items: { create: lines },
        steps: { create: stepNames.map((name, index) => ({ name, sortOrder: index })) },
        events: { create: { userId: user.id, message: `${user.name} criou o orçamento.` } },
      },
    });
    return created.id;
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "VEHICLE") return "VEHICLE";
    throw error;
  });

  if (orderId === "VEHICLE") return { error: "O veículo não pertence a este cliente." };
  revalidatePath("/os");
  revalidatePath("/");
  redirect(`/os/${orderId}`);
}

function uniqueStepNames(
  ids: string[],
  catalogById: Map<string, { type: string; name: string; components: { component: { name: string } }[] }>,
) {
  const names: string[] = [];
  for (const id of ids) {
    const source = catalogById.get(id);
    if (!source) continue;
    if (source.type === "PACKAGE") names.push(...source.components.map((component) => component.component.name));
    else names.push(source.name);
  }
  return [...new Set(names)];
}

async function replaceSteps(
  tx: Prisma.TransactionClient,
  workOrderId: string,
  names: string[],
  previous: { name: string; done: boolean; doneAt: Date | null; doneById: string | null }[],
) {
  const done = new Map(previous.filter((step) => step.done).map((step) => [step.name, step]));
  await tx.serviceStep.deleteMany({ where: { workOrderId } });
  if (names.length === 0) return;
  await tx.serviceStep.createMany({
    data: names.map((name, index) => ({
      workOrderId,
      name,
      sortOrder: index,
      done: done.has(name),
      doneAt: done.get(name)?.doneAt ?? null,
      doneById: done.get(name)?.doneById ?? null,
    })),
  });
}

async function loadAccessible(id: string) {
  const user = await requireUser();
  const order = await prisma.workOrder.findUnique({
    where: { id },
    include: { items: true, payments: true, assignedTo: true },
  });
  if (!order) redirect("/os");
  if (user.role === "APPLICATOR" && order.assignedToId !== user.id) redirect("/os");
  return { user, order };
}

export async function transitionOrder(formData: FormData) {
  const id = String(formData.get("orderId") ?? "");
  const to = asStatus(String(formData.get("to") ?? ""));
  const { user, order } = await loadAccessible(id);
  const from = asStatus(order.status);
  if (!from || !to || to === "CANCELLED" || !availableTransitions(from, user.role).includes(to)) {
    fail(id, "Esta mudança de situação não está disponível.");
  }
  const now = new Date();
  await prisma.workOrder.update({
    where: { id },
    data: {
      status: to,
      approvedAt: to === "APPROVED" ? now : order.approvedAt,
      readyAt: to === "READY" ? now : to === "IN_PROGRESS" ? null : order.readyAt,
      deliveredAt: to === "DELIVERED" ? now : order.deliveredAt,
      refusedAt: to === "REFUSED" ? now : to === "QUOTE" ? null : order.refusedAt,
      events: { create: { userId: user.id, message: `${user.name}: ${STATUS_ACTION[to as ServiceStatus]}.` } },
    },
  });
  revalidatePath("/os");
  revalidatePath(`/os/${id}`);
  redirect(`/os/${id}`);
}

export async function cancelOrder(formData: FormData) {
  const id = String(formData.get("orderId") ?? "");
  const reason = clip(formData.get("reason"), 400);
  const { user, order } = await loadAccessible(id);
  const from = asStatus(order.status);
  if (!from || !canManage(user.role) || !availableTransitions(from, user.role).includes("CANCELLED")) {
    fail(id, "Esta ordem não pode ser cancelada.");
  }
  if (reason.length < 5) fail(id, "Informe o motivo do cancelamento.");
  const paid = order.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  if (paid > 0 && user.role !== "OWNER") fail(id, "Há pagamento registrado. Só o dono cancela.");
  await prisma.workOrder.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelReason: reason,
      cancelledAt: new Date(),
      events: { create: { userId: user.id, message: `${user.name} cancelou a ordem. Motivo: ${reason}` } },
    },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "CANCEL", entity: "WorkOrder", entityId: id, detail: reason },
  });
  revalidatePath("/os");
  redirect(`/os/${id}`);
}

export async function registerPayment(formData: FormData) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const id = String(formData.get("orderId") ?? "");
  const order = await prisma.workOrder.findUnique({ where: { id }, include: { items: true, payments: true } });
  if (!order) redirect("/os");
  if (["CANCELLED", "REFUSED"].includes(order.status)) fail(id, "Esta ordem não recebe pagamento.");
  const amountCents = parseBRL(String(formData.get("amount") ?? ""));
  const method = String(formData.get("method") ?? "");
  if (amountCents === null || amountCents <= 0) fail(id, "Informe o valor recebido.");
  if (!["PIX", "CASH", "CARD"].includes(method)) fail(id, "Forma de pagamento inválida.");
  const totals = totalsOf(order);
  if (amountCents > totals.balanceCents) fail(id, "O valor passa do saldo em aberto.");
  const paidAt = parseDateInput(String(formData.get("paidAt") ?? "")) ?? new Date();
  const notes = clip(formData.get("notes"), 300);
  const nextPaid = totals.paidCents + amountCents;
  const nextStatus = totalsOf({ ...order, payments: [...order.payments, { amountCents }] }).paymentStatus;
  await prisma.payment.create({
    data: { workOrderId: id, amountCents, method, paidAt, notes, recordedById: user.id },
  });
  await prisma.workOrder.update({
    where: { id },
    data: {
      paymentStatus: nextStatus,
      events: {
        create: {
          userId: user.id,
          message: `${user.name} registrou um recebimento.`,
        },
      },
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "PAYMENT",
      entity: "WorkOrder",
      entityId: id,
      detail: `${amountCents} ${method} saldo ${nextPaid}`,
    },
  });
  revalidatePath("/recebimentos");
  revalidatePath("/a-receber");
  revalidatePath(`/os/${id}`);
  redirect(`/os/${id}`);
}

export async function toggleStep(formData: FormData) {
  const user = await requireUser();
  const stepId = String(formData.get("stepId") ?? "");
  const step = await prisma.serviceStep.findUnique({ where: { id: stepId }, include: { workOrder: true } });
  if (!step) redirect("/os");
  if (user.role === "APPLICATOR" && step.workOrder.assignedToId !== user.id) redirect("/os");
  if (!canManage(user.role) && user.role !== "APPLICATOR") redirect("/os");
  const done = !step.done;
  await prisma.serviceStep.update({
    where: { id: stepId },
    data: { done, doneAt: done ? new Date() : null, doneById: done ? user.id : null },
  });
  await prisma.orderEvent.create({
    data: {
      workOrderId: step.workOrderId,
      userId: user.id,
      message: done ? `${user.name} concluiu a etapa ${step.name}.` : `${user.name} reabriu a etapa ${step.name}.`,
    },
  });
  revalidatePath(`/os/${step.workOrderId}`);
  redirect(`/os/${step.workOrderId}`);
}

export async function addAttachment(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("orderId") ?? "");
  const kind = String(formData.get("kind") ?? "") === "AFTER" ? "AFTER" : "BEFORE";
  const order = await prisma.workOrder.findUnique({ where: { id } });
  if (!order) redirect("/os");
  if (user.role === "APPLICATOR" && order.assignedToId !== user.id) redirect("/os");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) fail(id, "Escolha uma foto.");
  try {
    const saved = await saveImage(file, `uploads/os/${id}`, `${kind.toLowerCase()}-${Date.now()}`, "photo");
    if (!saved) fail(id, "Escolha uma foto.");
    await prisma.attachment.create({ data: { workOrderId: id, kind, path: saved } });
    await prisma.orderEvent.create({
      data: { workOrderId: id, userId: user.id, message: `${user.name} anexou uma foto de ${kind === "BEFORE" ? "antes" : "depois"}.` },
    });
  } catch (error) {
    fail(id, error instanceof Error ? error.message : "Falha ao anexar a foto.");
  }
  revalidatePath(`/os/${id}`);
  redirect(`/os/${id}`);
}

export async function removeAttachment(formData: FormData) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) redirect("/os");
  await prisma.attachment.delete({ where: { id: attachmentId } });
  await removePublicFile(attachment.path);
  await prisma.orderEvent.create({
    data: { workOrderId: attachment.workOrderId, userId: user.id, message: `${user.name} removeu uma foto.` },
  });
  revalidatePath(`/os/${attachment.workOrderId}`);
  redirect(`/os/${attachment.workOrderId}`);
}

