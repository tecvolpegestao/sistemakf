"use client";

import { ComboBox } from "./combo-box";
import { Button, Field } from "./ui";
import { recordConsumption, removeConsumption } from "@/server/stock-actions";
import { formatBRL, formatDateTime, formatNumber } from "@/lib/format";

export function ConsumptionPanel({
  orderId,
  options,
  rows,
  showCost,
  canRemove,
  canRecord,
}: {
  orderId: string;
  options: { id: string; label: string }[];
  canRecord: boolean;
  rows: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    costCents: number;
    note: string;
    who: string;
    when: string;
  }[];
  showCost: boolean;
  canRemove: boolean;
}) {
  const real = rows.reduce((sum, row) => sum + row.costCents, 0);
  return (
    <div className="space-y-4">
      {canRecord && options.length > 0 ? (
        <form action={recordConsumption} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1.4fr)_8rem_minmax(0,1fr)_auto]">
          <input type="hidden" name="orderId" value={orderId} />
          <Field label="Item do estoque">
            <ComboBox
              name="catalogItemId"
              ariaLabel="Item do estoque"
              placeholder="Buscar produto"
              options={options.map((option) => ({ value: option.id, label: option.label }))}
            />
          </Field>
          <Field label="Quantidade">
            <input name="quantity" className="field" placeholder="0" />
          </Field>
          <Field label="Observação">
            <input name="note" className="field" placeholder="Opcional" />
          </Field>
          <Button type="submit" variant="secondary">
            Lançar consumo
          </Button>
        </form>
      ) : canRecord ? (
        <p className="text-sm text-muted">Nenhum produto com estoque para lançar.</p>
      ) : null}
      <ul className="divide-y divide-line text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 py-2">
            <div>
              <div>
                {row.name} · {formatNumber(row.quantity)} {row.unit}
                {showCost ? ` · ${formatBRL(row.costCents)}` : ""}
              </div>
              <div className="text-xs text-muted">
                {row.who} · {formatDateTime(new Date(row.when))}
                {row.note ? ` · ${row.note}` : ""}
              </div>
            </div>
            {canRemove ? (
              <form action={removeConsumption}>
                <input type="hidden" name="movementId" value={row.id} />
                <button type="submit" className="text-sm text-danger">
                  Remover
                </button>
              </form>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? <li className="py-2 text-muted">Nenhum consumo lançado.</li> : null}
      </ul>
      {showCost && rows.length > 0 ? <p className="text-sm">Custo real {formatBRL(real)}</p> : null}
    </div>
  );
}
