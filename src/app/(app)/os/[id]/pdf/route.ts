import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { priceBoxLabel, totalsOf } from "@/lib/domain";
import { formatDate, vehicleLine } from "@/lib/format";
import { buildQuotePdf, itemLineLabel } from "@/lib/pdf";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return new NextResponse("Não autorizado", { status: 401 });
  if (user.role === "APPLICATOR") return new NextResponse("Sem permissão", { status: 403 });
  const { id } = await context.params;
  const order = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      client: true,
      vehicle: true,
      items: { orderBy: { sortOrder: "asc" }, include: { catalogItem: { include: { components: { include: { component: true } } } } } },
      payments: true,
    },
  });
  if (!order) return new NextResponse("Não encontrado", { status: 404 });
  const settings = await getSettings();
  const totals = totalsOf(order);
  const pdf = await buildQuotePdf({
    number: order.number,
    clientName: order.client.tradeName || order.client.name,
    vehicleLine: order.vehicle ? vehicleLine(order.vehicle) : "",
    date: formatDate(order.createdAt),
    presentation: settings.presentation,
    closing: settings.closing,
    instagram: settings.instagram,
    city: settings.city,
    notes: order.notes,
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    totalCents: totals.totalCents,
    priceLabel: priceBoxLabel(order.items),
    partnerLogoPath: order.client.type === "PARTNER" ? order.client.logoPath : "",
    items: order.items.map((item) => ({
      name: item.name,
      description: item.description,
      includes: item.catalogItem?.type === "PACKAGE" ? item.catalogItem.components.map((component) => component.component.name) : [],
      lineLabel: itemLineLabel(item),
    })),
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="orcamento-${order.number}.pdf"`,
    },
  });
}
