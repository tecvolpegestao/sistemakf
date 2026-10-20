const TIME_ZONE = "America/Sao_Paulo";

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function centsToInput(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(ratio: number | null) {
  if (ratio === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(ratio);
}

export function formatNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: TIME_ZONE }).format(date);
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value;
}

export function daysSince(date: Date, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

export function startOfMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return new Date(`${year}-${month}-01T00:00:00-03:00`);
}

export function parseDateInput(value: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T${end ? "23:59:59" : "00:00:00"}-03:00`);
}

export function dateInput(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayInput(date = new Date()) {
  return dateInput(date);
}

export function whatsAppUrl(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}

export function quoteSummary(input: {
  number: number;
  clientName: string;
  vehicleLine: string;
  items: { name: string; detail: string }[];
  totalCents: number;
  priceLabel: string;
}) {
  return [
    "KF Detail — Orçamento",
    `Nº ${input.number}`,
    `Cliente: ${input.clientName}`,
    input.vehicleLine,
    "",
    ...input.items.map((item) => `• ${item.name}${item.detail ? ` — ${item.detail}` : ""}`),
    "",
    `${input.priceLabel}: ${formatBRL(input.totalCents)}`,
  ].join("\n");
}

export function vehicleLine(vehicle: {
  plate: string;
  brand: string;
  model: string;
  year?: number | null;
  color?: string | null;
}) {
  return [vehicle.plate, [vehicle.brand, vehicle.model].filter(Boolean).join(" "), vehicle.year || null, vehicle.color || null]
    .filter(Boolean)
    .join(" · ");
}

export function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function withParams(
  base: string,
  current: Record<string, string>,
  patch: Record<string, string | null>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (!value) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
