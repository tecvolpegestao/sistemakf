import type {
  BillingMode,
  DraftItemInput,
  MoneyLine,
  ParsedDraftItem,
  PaymentStatus,
  Role,
  ServiceStatus,
} from "./types";
import { BOARD_STATUSES } from "./types";

const TRANSITIONS: Record<ServiceStatus, ServiceStatus[]> = {
  QUOTE: ["AWAITING_APPROVAL", "CANCELLED"],
  AWAITING_APPROVAL: ["APPROVED", "REFUSED", "QUOTE", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["READY", "CANCELLED"],
  READY: ["DELIVERED", "IN_PROGRESS", "CANCELLED"],
  DELIVERED: ["CANCELLED"],
  REFUSED: ["QUOTE"],
  CANCELLED: [],
};

export function canSeeMoney(role: Role) {
  return role !== "APPLICATOR";
}

export function canSeeCosts(role: Role) {
  return role === "OWNER";
}

export function canManage(role: Role) {
  return role === "OWNER" || role === "ATTENDANT";
}

export function canTransition(from: ServiceStatus, to: ServiceStatus, role: Role) {
  if (!TRANSITIONS[from].includes(to)) return false;
  if (role === "APPLICATOR") {
    return (
      (from === "APPROVED" && to === "IN_PROGRESS") ||
      (from === "IN_PROGRESS" && to === "READY")
    );
  }
  if (to === "CANCELLED" && from === "DELIVERED") return role === "OWNER";
  return role === "OWNER" || role === "ATTENDANT";
}

export function availableTransitions(from: ServiceStatus, role: Role) {
  const destinations: ServiceStatus[] = [...BOARD_STATUSES, "REFUSED", "CANCELLED"];
  return destinations.filter((status) => canTransition(from, status, role));
}

export function lineTotalCents(item: {
  billing: string;
  quantity: number;
  meters: number | null;
  unitPriceCents: number;
}) {
  if (item.billing === "PER_METER") {
    return Math.round((item.meters ?? 0) * item.unitPriceCents);
  }
  return Math.round(item.quantity * item.unitPriceCents);
}

export function totalsOf(order: {
  discountCents: number;
  items: MoneyLine[];
  payments: { amountCents: number }[];
}) {
  const paidCents = order.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  return summarize(order.items, order.discountCents, paidCents);
}

export function summarize(items: MoneyLine[], discountCents: number, paidCents = 0) {
  const subtotalCents = items.reduce((sum, item) => sum + lineTotalCents(item), 0);
  const costCents = items.reduce((sum, item) => sum + item.costCents, 0);
  const appliedDiscount = Math.min(Math.max(0, discountCents), subtotalCents);
  const totalCents = subtotalCents - appliedDiscount;
  const balanceCents = Math.max(0, totalCents - Math.max(0, paidCents));
  return {
    subtotalCents,
    discountCents: appliedDiscount,
    totalCents,
    costCents,
    paidCents: Math.max(0, paidCents),
    balanceCents,
    margin: marginRatio(totalCents, costCents),
    paymentStatus: paymentStatus(totalCents, paidCents),
  };
}

export function marginRatio(priceCents: number, costCents: number) {
  if (priceCents <= 0) return null;
  return (priceCents - costCents) / priceCents;
}

export function packageCostCents(componentCosts: number[]) {
  return componentCosts.reduce((sum, cost) => sum + cost, 0);
}

export function paymentStatus(totalCents: number, paidCents: number): PaymentStatus {
  if (paidCents <= 0) return "UNPAID";
  if (paidCents + 0.0001 >= totalCents && totalCents > 0) return "PAID";
  if (totalCents <= 0 && paidCents > 0) return "PAID";
  return "PARTIAL";
}

export function lineCostCents(billing: string, quantity: number, meters: number | null, unitCostCents: number) {
  if (billing === "PER_METER") return Math.round((meters ?? 0) * unitCostCents);
  return Math.round(quantity * unitCostCents);
}

export function priceBoxLabel(items: { type: string; quantity: number; billing: string }[]) {
  const singlePackage =
    items.length === 1 &&
    items[0].type === "PACKAGE" &&
    items[0].quantity === 1 &&
    items[0].billing !== "PER_METER";
  return singlePackage ? "Valor por veículo" : "Valor total";
}

export function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidPlate(value: string) {
  const plate = normalizePlate(value);
  return /^[A-Z]{3}[0-9]{4}$/.test(plate) || /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate);
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function parseDecimal(input: string) {
  const clean = input.trim().replace(/\s/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function parseBRL(input: string) {
  const clean = input.trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (!clean || clean.startsWith("-")) return null;
  let normalized = clean;
  if (clean.includes(",")) {
    normalized = clean.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    normalized = clean.replace(/\./g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function parseDraftItem(
  input: DraftItemInput,
  billing: string,
): { ok: true; value: ParsedDraftItem } | { ok: false; error: string } {
  const unitPriceCents = parseBRL(input.price);
  if (unitPriceCents === null) return { ok: false, error: "Informe um preço válido." };
  if (billing === "PER_METER") {
    const meters = parseDecimal(input.meters);
    if (meters === null || meters <= 0) return { ok: false, error: "Informe a metragem prevista." };
    return { ok: true, value: { quantity: 1, meters, unitPriceCents } };
  }
  const quantity = parseDecimal(input.quantity);
  if (quantity === null || quantity <= 0) return { ok: false, error: "Informe a quantidade." };
  return { ok: true, value: { quantity, meters: null, unitPriceCents } };
}

export function billingForType(type: string, selected: string): BillingMode {
  if (type === "RESALE") return "PER_UNIT";
  if (type === "MATERIAL_SERVICE" && (selected === "PER_METER" || selected === "PER_SERVICE")) {
    return selected;
  }
  return "PER_SERVICE";
}

export function asRole(value: string): Role {
  if (value === "OWNER" || value === "ATTENDANT" || value === "APPLICATOR") return value;
  return "ATTENDANT";
}

export function asStatus(value: string): ServiceStatus | null {
  if (
    value === "QUOTE" ||
    value === "AWAITING_APPROVAL" ||
    value === "APPROVED" ||
    value === "IN_PROGRESS" ||
    value === "READY" ||
    value === "DELIVERED" ||
    value === "REFUSED" ||
    value === "CANCELLED"
  ) {
    return value;
  }
  return null;
}
