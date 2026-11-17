"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { billingForType, parseBRL, parseDecimal } from "@/lib/domain";
import { ICON_IDS } from "@/lib/labels";
import type { FormState } from "@/lib/types";

function clip(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function saveCatalog(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRoles(["OWNER"]);
  const id = clip(formData.get("id"), 40);
  const type = clip(formData.get("type"), 40);
  if (!["LABOR", "MATERIAL_SERVICE", "PACKAGE", "RESALE"].includes(type)) {
    return { error: "Tipo inválido." };
  }
  const name = clip(formData.get("name"), 120);
  const description = clip(formData.get("description"), 800);
  const category = clip(formData.get("category"), 80);
  const supplier = clip(formData.get("supplier"), 120);
  const unit = clip(formData.get("unit"), 20) || "un";
  const icon = ICON_IDS.has(clip(formData.get("icon"), 40)) ? clip(formData.get("icon"), 40) : "sparkles";
  const partnerId = clip(formData.get("partnerId"), 40);
  const active = formData.get("active") === "on";
  const priceCents = parseBRL(clip(formData.get("price"), 20));
  const costRaw = clip(formData.get("cost"), 20);
  const costCents = costRaw ? parseBRL(costRaw) : 0;
  const minRaw = clip(formData.get("minStock"), 20);
  const minStock = minRaw ? parseDecimal(minRaw) : 0;
  if (name.length < 2) return { error: "Informe o nome." };
  if (priceCents === null || costCents === null || minStock === null) return { error: "Preço ou custo inválido." };
  const billing = billingForType(type, clip(formData.get("billing"), 20));
  const componentIds = [...new Set(formData.getAll("componentId").map((value) => String(value)).filter(Boolean))];

  if (type === "PACKAGE" && componentIds.length === 0) {
    return { error: "Inclua pelo menos um serviço no pacote." };
  }
  if (partnerId) {
    const partner = await prisma.client.findFirst({ where: { id: partnerId, type: "PARTNER" } });
    if (!partner) return { error: "Parceiro não encontrado." };
  }

  const data = {
    type,
    name,
    description,
    priceCents,
    costCents,
    billing,
    icon,
    category,
    supplier,
    unit,
    minStock,
    active,
    partnerId: type === "PACKAGE" && partnerId ? partnerId : null,
  };

  const current = id ? await prisma.catalogItem.findUnique({ where: { id } }) : null;
  if (id && !current) return { error: "Item não encontrado." };
  const item = current
    ? await prisma.catalogItem.update({ where: { id }, data })
    : await prisma.catalogItem.create({ data });

  if (type === "PACKAGE") {
    await prisma.packageComponent.deleteMany({ where: { packageId: item.id } });
    await prisma.packageComponent.createMany({
      data: componentIds.map((componentId) => ({ packageId: item.id, componentId })),
    });
  } else if (current) {
    await prisma.packageComponent.deleteMany({ where: { packageId: item.id } });
  }

  if (current && current.priceCents !== priceCents) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PRICE_CHANGE",
        entity: "CatalogItem",
        entityId: item.id,
        detail: `${current.priceCents} -> ${priceCents}`,
      },
    });
  }

  revalidatePath("/catalogo");
  revalidatePath(`/catalogo/${item.id}`);
  redirect(`/catalogo/${item.id}`);
}

export async function duplicateCatalog(formData: FormData) {
  await requireRoles(["OWNER"]);
  const id = String(formData.get("id") ?? "");
  const item = await prisma.catalogItem.findUnique({ where: { id }, include: { components: true } });
  if (!item) redirect("/catalogo");
  const copy = await prisma.catalogItem.create({
    data: {
      type: item.type,
      name: `${item.name} (cópia)`.slice(0, 120),
      description: item.description,
      priceCents: item.priceCents,
      costCents: item.costCents,
      billing: item.billing,
      icon: item.icon,
      category: item.category,
      supplier: item.supplier,
      unit: item.unit,
      minStock: item.minStock,
      active: false,
      partnerId: item.partnerId,
      components: { create: item.components.map((component) => ({ componentId: component.componentId })) },
    },
  });
  revalidatePath("/catalogo");
  redirect(`/catalogo/${copy.id}`);
}

export async function toggleCatalog(formData: FormData) {
  await requireRoles(["OWNER"]);
  const id = String(formData.get("id") ?? "");
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) redirect("/catalogo");
  await prisma.catalogItem.update({ where: { id }, data: { active: !item.active } });
  revalidatePath("/catalogo");
  revalidatePath(`/catalogo/${id}`);
  redirect(`/catalogo/${id}`);
}
