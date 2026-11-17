"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { isValidPlate, normalizePhone, normalizePlate } from "@/lib/domain";
import { saveImage } from "@/lib/images";
import type { FormState } from "@/lib/types";

function clip(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function saveClient(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const id = clip(formData.get("id"), 40);
  const name = clip(formData.get("name"), 120);
  const phone = normalizePhone(clip(formData.get("phone"), 30));
  const email = clip(formData.get("email"), 120).toLowerCase();
  const document = clip(formData.get("document"), 30);
  const type = clip(formData.get("type"), 20) === "PARTNER" ? "PARTNER" : "PRIVATE";
  const notes = clip(formData.get("notes"), 2000);
  const tradeName = type === "PARTNER" ? clip(formData.get("tradeName"), 120) : "";
  const city = type === "PARTNER" ? clip(formData.get("city"), 80) : "";
  const pixKey = type === "PARTNER" ? clip(formData.get("pixKey"), 140) : "";
  if (name.length < 2) return { error: "Informe o nome." };
  if (phone && phone.length < 10) return { error: "Telefone incompleto." };

  const current = id ? await prisma.client.findUnique({ where: { id } }) : null;
  if (id && !current) return { error: "Cliente não encontrado." };
  const data = {
    name,
    phone,
    email,
    document,
    type,
    notes,
    tradeName,
    city,
    pixKey,
    logoPath: type === "PARTNER" ? current?.logoPath ?? "" : "",
  };
  const client = current
    ? await prisma.client.update({ where: { id }, data })
    : await prisma.client.create({ data });

  const logo = formData.get("logo");
  if (type === "PARTNER" && logo instanceof File && logo.size > 0) {
    try {
      const saved = await saveImage(logo, "uploads/partners", client.id, "logo");
      if (saved) await prisma.client.update({ where: { id: client.id }, data: { logoPath: saved } });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Falha ao salvar a logo." };
    }
  }

  revalidatePath("/clientes");
  revalidatePath("/parceiros");
  revalidatePath(`/clientes/${client.id}`);
  revalidatePath(`/parceiros/${client.id}`);
  redirect(type === "PARTNER" ? `/parceiros/${client.id}` : `/clientes/${client.id}`);
}

export async function saveVehicle(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRoles(["OWNER", "ATTENDANT"]);
  const id = clip(formData.get("id"), 40);
  const clientId = clip(formData.get("clientId"), 40);
  const plate = normalizePlate(clip(formData.get("plate"), 12));
  const brand = clip(formData.get("brand"), 60);
  const model = clip(formData.get("model"), 60);
  const color = clip(formData.get("color"), 40);
  const notes = clip(formData.get("notes"), 1000);
  const yearRaw = clip(formData.get("year"), 4);
  const year = yearRaw ? Number(yearRaw) : null;
  if (!isValidPlate(plate)) return { error: "Placa inválida. Use o padrão antigo ou Mercosul." };
  if (!brand || !model) return { error: "Informe marca e modelo." };
  if (year !== null && (!Number.isInteger(year) || year < 1950 || year > 2100)) return { error: "Ano inválido." };
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { error: "Cliente não encontrado." };

  const existing = await prisma.vehicle.findFirst({
    where: { plate, ...(id ? { NOT: { id } } : {}) },
    include: { client: true },
  });
  if (existing) {
    return { error: `Esta placa já está com ${existing.client.name}.` };
  }

  const data = { clientId, plate, brand, model, year, color, notes };
  const vehicle = id
    ? await prisma.vehicle.update({ where: { id }, data })
    : await prisma.vehicle.create({ data });
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath(`/parceiros/${clientId}`);
  revalidatePath(`/veiculos/${vehicle.id}`);
  redirect(`/veiculos/${vehicle.id}`);
}
