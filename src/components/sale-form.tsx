"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { saveSale } from "@/server/sale-actions";
import { centsToInput, formatBRL } from "@/lib/format";
import { parseBRL, parseDecimal } from "@/lib/domain";
import type { FormState } from "@/lib/types";
import { ComboBox } from "./combo-box";
import { Alert, Button, Field, Panel } from "./ui";

type Product = { id: string; name: string; priceCents: number; unit: string; onHand: number };
type Line = { key: string; catalogItemId: string; quantity: string; price: string };

export function SaleForm({
  products,
  clients,
}: {
  products: Product[];
  clients: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveSale, null as FormState);
  const [clientId, setClientId] = useState("");
  const [method, setMethod] = useState("PIX");
  const [received, setReceived] = useState(true);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: "1", catalogItemId: "", quantity: "1", price: "" }]);

  const total = useMemo(() => {
    return lines.reduce((sum, line) => {
      const quantity = parseDecimal(line.quantity) ?? 0;
      const price = parseBRL(line.price) ?? 0;
      return sum + Math.round(quantity * price);
    }, 0);
  }, [lines]);

  const payload = {
    clientId,
    notes,
    method,
    received,
    lines: lines.filter((line) => line.catalogItemId),
  };

  function setLine(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  return (
    <form action={action} className="max-w-3xl space-y-4">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Panel className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente" hint="Opcional. A venda de balcão pode ficar sem cadastro.">
          <ComboBox
            ariaLabel="Cliente"
            placeholder="Buscar cliente"
            value={clientId}
            onChange={setClientId}
            options={[{ value: "", label: "Sem cliente" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]}
          />
        </Field>
        <Field label="Forma">
          <ComboBox
            ariaLabel="Forma de pagamento"
            value={method}
            onChange={setMethod}
            options={[
              { value: "PIX", label: "Pix" },
              { value: "CASH", label: "Dinheiro" },
              { value: "CARD", label: "Cartão" },
            ]}
          />
        </Field>
      </Panel>
      <Panel className="space-y-4">
        <h2 className="font-display text-lg">Produtos</h2>
        {lines.map((line) => {
          const product = products.find((item) => item.id === line.catalogItemId);
          return (
            <div key={line.key} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1.4fr)_7rem_8rem_auto]">
              <Field label="Produto">
                <ComboBox
                  ariaLabel="Produto"
                  placeholder="Buscar produto"
                  value={line.catalogItemId}
                  onChange={(next) => {
                    const chosen = products.find((item) => item.id === next);
                    setLine(line.key, { catalogItemId: next, price: chosen ? centsToInput(chosen.priceCents) : line.price });
                  }}
                  options={products.map((item) => ({
                    value: item.id,
                    label: `${item.name} · ${formatBRL(item.priceCents)} · ${item.onHand} ${item.unit}`,
                  }))}
                />
              </Field>
              <Field label="Quantidade">
                <input className="field" value={line.quantity} onChange={(event) => setLine(line.key, { quantity: event.target.value })} />
              </Field>
              <Field label="Preço">
                <input className="field" value={line.price} onChange={(event) => setLine(line.key, { price: event.target.value })} />
              </Field>
              <button
                type="button"
                className="button-line"
                onClick={() => setLines((current) => (current.length === 1 ? current : current.filter((item) => item.key !== line.key)))}
              >
                Remover
              </button>
              {product ? <p className="text-xs text-muted sm:col-span-4">Disponível: {product.onHand} {product.unit}</p> : null}
            </div>
          );
        })}
        <button
          type="button"
          className="text-sm font-medium text-link"
          onClick={() => setLines((current) => [...current, { key: String(Date.now()), catalogItemId: "", quantity: "1", price: "" }])}
        >
          Adicionar produto
        </button>
      </Panel>
      <Panel className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Total</span>
          <span className="font-display text-2xl tabular-nums">{formatBRL(total)}</span>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={received} onChange={(event) => setReceived(event.target.checked)} />
          Recebido agora
        </label>
        <Field label="Observações">
          <textarea className="field" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Registrar venda"}
        </Button>
      </Panel>
    </form>
  );
}
