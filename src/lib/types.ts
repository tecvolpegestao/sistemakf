export const ROLES = ["OWNER", "ATTENDANT", "APPLICATOR"] as const;
export type Role = (typeof ROLES)[number];

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export const SERVICE_STATUSES = [
  "QUOTE",
  "AWAITING_APPROVAL",
  "APPROVED",
  "IN_PROGRESS",
  "READY",
  "DELIVERED",
  "REFUSED",
  "CANCELLED",
] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CATALOG_TYPES = ["LABOR", "MATERIAL_SERVICE", "PACKAGE", "RESALE"] as const;
export type CatalogType = (typeof CATALOG_TYPES)[number];

export const BILLING_MODES = ["PER_SERVICE", "PER_METER", "PER_UNIT"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export const PAYMENT_METHODS = ["PIX", "CASH", "CARD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CLIENT_TYPES = ["PRIVATE", "PARTNER"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const BILLABLE_STATUSES: ServiceStatus[] = [
  "APPROVED",
  "IN_PROGRESS",
  "READY",
  "DELIVERED",
];

export const BOARD_STATUSES: ServiceStatus[] = [
  "QUOTE",
  "AWAITING_APPROVAL",
  "APPROVED",
  "IN_PROGRESS",
  "READY",
  "DELIVERED",
];

export type DraftItemInput = {
  catalogItemId: string;
  quantity: string;
  meters: string;
  price: string;
};

export type ParsedDraftItem = {
  quantity: number;
  meters: number | null;
  unitPriceCents: number;
};

export type MoneyLine = {
  billing: string;
  quantity: number;
  meters: number | null;
  unitPriceCents: number;
  costCents: number;
};

export type OrderFormState = {
  error: string;
  code?: "DUPLICATE_PHONE" | "DUPLICATE_PLATE" | "VALIDATION";
  existingHref?: string;
  existingLabel?: string;
  existingVehicleId?: string;
} | null;

export type FormState = { error: string } | null;
