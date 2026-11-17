"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/auth";

export async function saveSettings(formData: FormData) {
  const user = await requireRoles(["OWNER"]);
  const entries = [
    ["presentation", clip(formData.get("presentation"), 2000)],
    ["closing", clip(formData.get("closing"), 2000)],
    ["instagram", clip(formData.get("instagram"), 80)],
    ["city", clip(formData.get("city"), 80)],
    ["pixKey", clip(formData.get("pixKey"), 140)],
  ] as const;
  await prisma.$transaction(
    entries.map(([key, value]) => prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })),
  );
  await prisma.auditLog.create({
    data: { userId: user.id, action: "SETTINGS", entity: "Setting", entityId: "company", detail: "Textos e dados da empresa atualizados." },
  });
  revalidatePath("/configuracoes");
  redirect("/configuracoes?salvo=1");
}

function clip(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}
