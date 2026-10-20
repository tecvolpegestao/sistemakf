import "server-only";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { formatBRL, formatNumber } from "./format";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit") as new (options: PDFKit.PDFDocumentOptions) => PDFKit.PDFDocument;

export type QuotePdfItem = {
  name: string;
  description: string;
  includes: string[];
  lineLabel: string;
};

export type QuotePdfInput = {
  number: number;
  clientName: string;
  vehicleLine: string;
  date: string;
  presentation: string;
  closing: string;
  instagram: string;
  city: string;
  notes: string;
  items: QuotePdfItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  priceLabel: string;
  partnerLogoPath?: string;
};

function fontPath(file: string) {
  return path.join(process.cwd(), "assets", "fonts", file);
}

function publicFile(urlPath: string) {
  if (!urlPath.startsWith("/")) return null;
  const file = path.join(process.cwd(), "public", urlPath);
  return fs.existsSync(file) ? file : null;
}

export function buildQuotePdf(input: QuotePdfInput) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: { Title: `Orçamento ${input.number}`, Author: "KF Detail" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("Inter", fontPath("Inter-Regular.ttf"));
    doc.registerFont("Inter-Semibold", fontPath("Inter-SemiBold.ttf"));
    doc.registerFont("Montserrat", fontPath("Montserrat-SemiBold.ttf"));

    const left = 48;
    const width = doc.page.width - 96;
    let y = 46;
    const logo = publicFile("/brand/logo-light.png");
    if (logo) doc.image(logo, left, y, { height: 58 });
    const partnerLogo = input.partnerLogoPath ? publicFile(input.partnerLogoPath) : null;
    if (partnerLogo) {
      doc.image(partnerLogo, left + width - 88, y + 6, { fit: [88, 46], align: "right" });
    }

    y = 118;
    doc.font("Montserrat").fontSize(20).fillColor("#211F20").text("Orçamento de Serviços", left, y, { width });
    y = doc.y + 4;
    doc.font("Inter").fontSize(12).fillColor("#5E5C5D").text(input.clientName, left, y, { width });
    y = doc.y + 14;

    doc.roundedRect(left, y, width, 52, 6).fill("#F5F5F5");
    doc.fillColor("#211F20").font("Inter-Semibold").fontSize(11).text(input.vehicleLine || "Veículo a definir", left + 14, y + 10, {
      width: width - 28,
    });
    doc.font("Inter").fontSize(10).fillColor("#5E5C5D").text(`Orçamento ${input.number}  ·  ${input.date}`, left + 14, y + 28, {
      width: width - 28,
    });
    y += 68;

    doc.fillColor("#211F20").font("Inter").fontSize(10.5).text(input.presentation, left, y, { width, lineGap: 3 });
    y = doc.y + 18;
    doc.font("Montserrat").fontSize(12).fillColor("#211F20").text("Serviços", left, y);
    y = doc.y + 10;

    for (const item of input.items) {
      if (y > 680) {
        doc.addPage();
        y = 48;
      }
      const rowY = y;
      doc.rect(left, rowY + 3, 3, 14).fill("#0149D3");
      doc.fillColor("#211F20").font("Inter-Semibold").fontSize(11).text(item.name, left + 14, rowY, { width: width - 160 });
      const nameBottom = doc.y;
      doc.font("Inter").fontSize(11).fillColor("#211F20").text(item.lineLabel, left, rowY, { width, align: "right" });
      y = Math.max(nameBottom, doc.y) + 2;
      if (item.description) {
        doc.font("Inter").fontSize(9.5).fillColor("#5E5C5D").text(item.description, left + 14, y, { width: width - 28 });
        y = doc.y + 2;
      }
      if (item.includes.length > 0) {
        doc.font("Inter").fontSize(9.5).fillColor("#5E5C5D").text(
          item.includes.map((name) => `• ${name}`).join("\n"),
          left + 14,
          y,
          { width: width - 28, lineGap: 1 },
        );
        y = doc.y + 2;
      }
      y += 10;
    }

    if (input.discountCents > 0) {
      doc.font("Inter").fontSize(10).fillColor("#5E5C5D").text(
        `Subtotal ${formatBRL(input.subtotalCents)}    Desconto ${formatBRL(input.discountCents)}`,
        left,
        y,
        { width, align: "right" },
      );
      y = doc.y + 10;
    }

    if (input.notes.trim()) {
      doc.font("Inter-Semibold").fontSize(10).fillColor("#211F20").text("Observações", left, y);
      y = doc.y + 3;
      doc.font("Inter").fontSize(10).fillColor("#5E5C5D").text(input.notes.trim(), left, y, { width, lineGap: 2 });
      y = doc.y + 14;
    }

    if (y > 730) {
      doc.addPage();
      y = 48;
    }
    doc.roundedRect(left, y, width, 68, 8).fill("#0149D3");
    doc.fillColor("#FFFFFF").font("Inter").fontSize(10).text(input.priceLabel, left + 18, y + 14, { width: width - 36 });
    doc.font("Montserrat").fontSize(22).text(formatBRL(input.totalCents), left + 18, y + 32, { width: width - 36 });
    y += 86;

    doc.fillColor("#211F20").font("Inter").fontSize(10).text(input.closing, left, y, { width, lineGap: 2 });
    y = doc.y + 26;
    if (y > 740) {
      doc.addPage();
      y = 48;
    }

    const column = width / 2 - 16;
    doc.strokeColor("#211F20").lineWidth(0.7);
    doc.moveTo(left, y + 22).lineTo(left + column, y + 22).stroke();
    doc.moveTo(left + width - column, y + 22).lineTo(left + width, y + 22).stroke();
    doc.font("Inter").fontSize(9).fillColor("#5E5C5D");
    doc.text("KF Detail", left, y + 28, { width: column });
    doc.text(input.clientName, left + width - column, y + 28, { width: column });
    doc.text("Assinatura", left, y + 42, { width: column });
    doc.text("Assinatura ou carimbo", left + width - column, y + 42, { width: column });
    y += 68;
    doc.text(`Data: ${input.date}`, left, y);
    y += 28;
    doc.strokeColor("#E0E0E0").lineWidth(0.6).moveTo(left, y).lineTo(left + width, y).stroke();
    const footer = [input.instagram, input.city].filter(Boolean).join("   ·   ");
    if (footer) {
      doc.font("Inter").fontSize(9).fillColor("#5E5C5D").text(footer, left, y + 8, { width, align: "center" });
    }
    doc.end();
  });
}

export function itemLineLabel(item: {
  billing: string;
  quantity: number;
  meters: number | null;
  unitPriceCents: number;
}) {
  const total = item.billing === "PER_METER"
    ? Math.round((item.meters ?? 0) * item.unitPriceCents)
    : Math.round(item.quantity * item.unitPriceCents);
  if (item.billing === "PER_METER") {
    return `${formatNumber(item.meters ?? 0)} m  ·  ${formatBRL(total)}`;
  }
  if (item.quantity !== 1) {
    return `${formatNumber(item.quantity)} × ${formatBRL(item.unitPriceCents)}  ·  ${formatBRL(total)}`;
  }
  return formatBRL(total);
}
