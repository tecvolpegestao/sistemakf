import "server-only";
import { prisma } from "./db";
import { movementCostCents, stockPosition } from "./domain";

export async function loadStock() {
  const items = await prisma.catalogItem.findMany({
    where: { type: { in: ["RESALE", "MATERIAL_SERVICE"] } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const movements = await prisma.stockMovement.findMany({
    where: { catalogItemId: { in: items.map((item) => item.id) } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return items.map((item) => {
    const position = stockPosition(movements.filter((movement) => movement.catalogItemId === item.id));
    return {
      ...item,
      ...position,
      low: item.minStock > 0 && position.quantity < item.minStock - 0.0001,
    };
  });
}

export function consumptionCost(quantity: number, unitCostCents: number) {
  return movementCostCents(quantity, unitCostCents);
}
