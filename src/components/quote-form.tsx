"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { saveOrder } from "@/server/order-actions";
import { lineCostCents, packageCostCents, parseBRL, parseDraftItem, priceBoxLabel, totalsOf } from "@/lib/domain";
import { centsToInput, formatBRL, formatPercent } from "@/lib/format";
import { BILLING_LABEL, TYPE_LABEL } from "@/lib/labels";
import type { DraftItemInput, OrderFormState } from "@/lib/types";
import { useActionState } from "react";
import { Alert, Button, Field, Panel } from "./ui";

export type CatalogChoice = {
  id: string;
  type: string;
  name: string;
  description: string;
  priceCents: number;
  costCents: number;
  billing: string;
  active: boolean;
  partnerId: string | null;
  components: { name: string; costCents: number }[];
};

export type ClientChoice = {
  id: string;
  name: string;
  phone: string;
  type: string;
  vehicles: { id: string; plate: string; brand: string; model: string; year: number | null; color: string }[];
};

type Draft = DraftItemInput;

export function QuoteForm({
  orderId,
  clients,
  catalog,
  applicators,
  canSeeCosts,
  initial,
}: {
  orderId?: string;
  clients: ClientChoice[];
  catalog: CatalogChoice[];
  applicators: { id: string; name: string }[];
  canSeeCosts: boolean;
  initial?: {
    clientId: string;
    vehicleId: string;
    items: Draft[];
    discount: string;
    notes: string;
    assignedToId: string;
  };
}) {
  const [state, action, pending] = useActionState(saveOrder, null as OrderFormState);
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? "");
  const [newClient, setNewClient] = useState({ name: "", phone: "", email: "", type: "PRIVATE" });
  const [newVehicle, setNewVehicle] = useState({ plate: "", brand: "", model: "", year: "", color: "" });
  const [items, setItems] = useState<Draft[]>(initial?.items ?? []);
  const [discount, setDiscount] = useState(initial?.discount ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [assignedToId, setAssignedToId] = useState(initial?.assignedToId ?? "");
  const [addId, setAddId] = useState("");
  const [confirmPhone, setConfirmPhone] = useState(false);

  const client = clients.find((item) => item.id === clientId) ?? null;
  const choices = catalog.filter((item) => {
    if (item.type === "RESALE") return false;
    if (!item.active && !items.some((line) => line.catalogItemId === item.id)) return false;
    if (item.type === "PACKAGE" && item.partnerId && item.partnerId !== clientId) return false;
    return true;
  });
  const partnerPackages = catalog.filter((item) => item.type === "PACKAGE" && item.active && item.partnerId === clientId);

  useEffect(() => {
    if (!client || client.type !== "PARTNER" || items.length > 0) return;
    const packs = catalog.filter((item) => item.type === "PACKAGE" && item.active && item.partnerId === client.id);
    if (packs.length === 0) return;
    setItems(packs.map((item) => ({ catalogItemId: item.id, quantity: "1", meters: "", price: centsToInput(item.priceCents) })));
  }, [client, catalog, items.length]);

  function addItem(id = addId) {
    const source = catalog.find((item) => item.id === id);
    if (!source || items.some((item) => item.catalogItemId === source.id)) return;
    setItems((current) => [
      ...current,
      { catalogItemId: source.id, quantity: "1", meters: "", price: centsToInput(source.priceCents) },
    ]);
    setAddId("");
  }

  const preview = useMemo(() => buildPreview(items, catalog, discount), [items, catalog, discount]);
  const payload = {
    orderId: orderId ?? null,
    clientId: clientId || null,
    newClient: clientId ? null : newClient,
    vehicleId: vehicleId || null,
    newVehicle: vehicleId ? null : newVehicle,
    confirmPhone,
    items,
    discount,
    notes,
    assignedToId,
  };

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <div className="space-y-6">
        {state?.error ? (
          <Alert>
            <p>{state.error}</p>
            {state.existingHref ? (
              <p className="mt-2">
                <Link href={state.existingHref} className="font-medium text-link">
                  Abrir {state.existingLabel}
                </Link>
              </p>
            ) : null}
            {state.code === "DUPLICATE_PLATE" && state.existingVehicleId ? (
              <button
                type="button"
                className="mt-2 text-sm font-medium text-link"
                onClick={() => setVehicleId(state.existingVehicleId ?? "")}
              >
                Usar este veículo no orçamento
              </button>
            ) : null}
            {state.code === "DUPLICATE_PHONE" ? (
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={confirmPhone} onChange={(event) => setConfirmPhone(event.target.checked)} />
                Continuar com outro cliente neste telefone
              </label>
            ) : null}
          </Alert>
        ) : null}

        <Panel className="space-y-4">
          <h2 className="font-display text-lg">Cliente</h2>
          <Field label="Cliente">
            <select
              className="field"
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
                setVehicleId("");
              }}
            >
              <option value="">Cadastrar agora</option>
              {clients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.type === "PARTNER" ? "Parceiro" : "Particular"}
                </option>
              ))}
            </select>
          </Field>
          {!clientId ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome">
                <input className="field" value={newClient.name} onChange={(event) => setNewClient({ ...newClient, name: event.target.value })} />
              </Field>
              <Field label="Telefone">
                <input className="field" value={newClient.phone} onChange={(event) => setNewClient({ ...newClient, phone: event.target.value })} />
              </Field>
              <Field label="E-mail">
                <input className="field" value={newClient.email} onChange={(event) => setNewClient({ ...newClient, email: event.target.value })} />
              </Field>
              <Field label="Tipo">
                <select className="field" value={newClient.type} onChange={(event) => setNewClient({ ...newClient, type: event.target.value })}>
                  <option value="PRIVATE">Particular</option>
                  <option value="PARTNER">Parceiro</option>
                </select>
              </Field>
            </div>
          ) : null}
          {client?.type === "PARTNER" && partnerPackages.length > 0 ? (
            <p className="text-sm text-muted">
              Pacote combinado: {partnerPackages.map((item) => `${item.name} (${formatBRL(item.priceCents)})`).join(", ")}.
              {partnerPackages.some((item) => !items.some((line) => line.catalogItemId === item.id)) ? (
                <button type="button" className="ml-2 font-medium text-link" onClick={() => addItem(partnerPackages[0].id)}>
                  Adicionar pacote
                </button>
              ) : null}
            </p>
          ) : null}
        </Panel>

        <Panel className="space-y-4">
          <h2 className="font-display text-lg">Veículo</h2>
          {client ? (
            <Field label="Veículo do cliente">
              <select className="field" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
                <option value="">Cadastrar agora</option>
                {client.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate} · {vehicle.brand} {vehicle.model}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {!vehicleId ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Placa">
                <input className="field uppercase" value={newVehicle.plate} onChange={(event) => setNewVehicle({ ...newVehicle, plate: event.target.value.toUpperCase() })} />
              </Field>
              <Field label="Marca">
                <input className="field" value={newVehicle.brand} onChange={(event) => setNewVehicle({ ...newVehicle, brand: event.target.value })} />
              </Field>
              <Field label="Modelo">
                <input className="field" value={newVehicle.model} onChange={(event) => setNewVehicle({ ...newVehicle, model: event.target.value })} />
              </Field>
              <Field label="Ano">
                <input className="field" inputMode="numeric" value={newVehicle.year} onChange={(event) => setNewVehicle({ ...newVehicle, year: event.target.value })} />
              </Field>
              <Field label="Cor">
                <input className="field" value={newVehicle.color} onChange={(event) => setNewVehicle({ ...newVehicle, color: event.target.value })} />
              </Field>
            </div>
          ) : null}
        </Panel>

        <Panel className="space-y-4">
          <h2 className="font-display text-lg">Itens</h2>
          {choices.length === 0 ? (
            <p className="text-sm text-muted">Nenhum serviço ativo no catálogo.</p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <select className="field" value={addId} onChange={(event) => setAddId(event.target.value)} aria-label="Item do catálogo">
                <option value="">Escolher serviço ou pacote</option>
                {(["PACKAGE", "LABOR", "MATERIAL_SERVICE"] as const).map((type) => {
                  const group = choices.filter((item) => item.type === type);
                  if (group.length === 0) return null;
                  return (
                    <optgroup key={type} label={TYPE_LABEL[type]}>
                      {group.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {formatBRL(item.priceCents)}
                          {item.billing === "PER_METER" ? " / m" : ""}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              <Button type="button" variant="secondary" onClick={() => addItem()}>
                Adicionar
              </Button>
            </div>
          )}
          <ul className="space-y-3">
            {items.map((item) => {
              const source = catalog.find((entry) => entry.id === item.catalogItemId);
              if (!source) return null;
              return (
                <li key={item.catalogItemId} className="rounded-md border border-line bg-bg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{source.name}</div>
                      <div className="text-xs text-muted">{BILLING_LABEL[source.billing as keyof typeof BILLING_LABEL]}</div>
                    </div>
                    <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => setItems((current) => current.filter((line) => line.catalogItemId !== item.catalogItemId))}>
                      Remover
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {source.billing === "PER_METER" ? (
                      <Field label="Metragem prevista">
                        <input className="field" value={item.meters} onChange={(event) => updateItem(setItems, item.catalogItemId, { meters: event.target.value })} />
                      </Field>
                    ) : (
                      <Field label="Quantidade">
                        <input className="field" value={item.quantity} onChange={(event) => updateItem(setItems, item.catalogItemId, { quantity: event.target.value })} />
                      </Field>
                    )}
                    <Field label={source.billing === "PER_METER" ? "Preço por metro" : "Preço"}>
                      <input className="field" value={item.price} onChange={(event) => updateItem(setItems, item.catalogItemId, { price: event.target.value })} />
                    </Field>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel>
          <Field label="Observações">
            <textarea className="field min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </Panel>
      </div>

      <aside className="h-fit space-y-4 lg:sticky lg:top-20">
        <Panel className="space-y-3">
          <h2 className="font-display text-lg">Resumo</h2>
          {preview.ok ? (
            <>
              <Row label="Subtotal" value={formatBRL(preview.subtotalCents)} />
              <Field label="Desconto">
                <input className="field" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="0,00" />
              </Field>
              <div className="rounded-md bg-primary px-3 py-3 text-on-primary">
                <div className="text-xs">{preview.priceLabel}</div>
                <div className="font-display text-2xl tabular-nums">{formatBRL(preview.totalCents)}</div>
              </div>
              {canSeeCosts ? (
                <p className="text-xs text-muted">
                  Custo estimado {preview.costCents > 0 ? formatBRL(preview.costCents) : "ainda não informado"} · margem{" "}
                  {preview.costCents > 0 ? formatPercent(preview.margin) : "—"}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted">{preview.error}</p>
          )}
          {applicators.length > 0 ? (
            <Field label="Aplicador">
              <select className="field" value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)}>
                <option value="">Definir depois</option>
                {applicators.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Salvando..." : "Salvar orçamento"}
          </Button>
        </Panel>
      </aside>
    </form>
  );
}

function updateItem(setItems: React.Dispatch<React.SetStateAction<Draft[]>>, id: string, patch: Partial<Draft>) {
  setItems((current) => current.map((item) => (item.catalogItemId === id ? { ...item, ...patch } : item)));
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function buildPreview(items: Draft[], catalog: CatalogChoice[], discount: string) {
  if (items.length === 0) return { ok: false as const, error: "Adicione um item para ver o total." };
  const lines = [];
  const kinds: { type: string; quantity: number; billing: string }[] = [];
  for (const item of items) {
    const source = catalog.find((entry) => entry.id === item.catalogItemId);
    if (!source) return { ok: false as const, error: "Item removido do catálogo." };
    const parsed = parseDraftItem(item, source.billing);
    if (!parsed.ok) return { ok: false as const, error: parsed.error };
    const unitCost = source.type === "PACKAGE" ? packageCostCents(source.components.map((component) => component.costCents)) : source.costCents;
    lines.push({
      billing: source.billing,
      quantity: parsed.value.quantity,
      meters: parsed.value.meters,
      unitPriceCents: parsed.value.unitPriceCents,
      costCents: lineCostCents(source.billing, parsed.value.quantity, parsed.value.meters, unitCost),
    });
    kinds.push({ type: source.type, quantity: parsed.value.quantity, billing: source.billing });
  }
  const discountCents = discount.trim() ? parseBRL(discount) : 0;
  if (discountCents === null) return { ok: false as const, error: "Desconto inválido." };
  const totals = totalsOf({ discountCents, items: lines, payments: [] });
  return { ok: true as const, ...totals, priceLabel: priceBoxLabel(kinds) };
}
