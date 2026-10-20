import "server-only";
import { prisma } from "./db";
import { DEFAULT_CLOSING, DEFAULT_PRESENTATION } from "./labels";

export type CompanySettings = {
  presentation: string;
  closing: string;
  instagram: string;
  city: string;
  pixKey: string;
};

export async function getSettings(): Promise<CompanySettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    presentation: map.get("presentation") || DEFAULT_PRESENTATION,
    closing: map.get("closing") || DEFAULT_CLOSING,
    instagram: map.get("instagram") ?? "",
    city: map.get("city") ?? "",
    pixKey: map.get("pixKey") ?? "",
  };
}
