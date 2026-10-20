"use client";

import { useActionState, useState } from "react";
import { saveCatalog } from "@/server/catalog-actions";
import { centsToInput } from "@/lib/format";
import { ICONS, TYPE_LABEL } from "@/lib/labels";
import type { FormState } from "@/lib/types";
import { Alert, Button, Field, Panel } from "./ui";
import { ServiceIcon } from "./service-icon";

export function CatalogForm({
  item,
  services,
  partners,
}: {
  item?: {
    id: string;
    type: string;
    name: string;
    description: string;
    priceCents: number;
    costCents: number;
    billing: string;
    icon: string;
    category: string;
    supplier: string;
    unit: string;
    minStock: number;
    active: boolean;
    partnerId: string | null;
    componentIds: string[];
  };
  services: { id: string; name: string; type: string }[];
  partners: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveCatalog, null as FormState);
  const [type, setType] = useState(item?.type ?? "LABOR");

  return (
    <form action={action} className="max-w-2xl space-y-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Panel className="grid gap-4">
        <Field label="Tipo">
          <select name="type" className="field" value={type} onChange={(event) => setType(event.target.value)}>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nome">
          <input name="name" className="field" defaultValue={item?.name ?? ""} required />
        </Field>
        <Field label={type === "PACKAGE" ? "Texto de apresentação" : "Descrição no orçamento"}>
          <textarea name="description" className="field min-h-24" defaultValue={item?.description ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={type === "MATERIAL_SERVICE" ? "Preço" : "Preço"}>
            <input name="price" className="field" defaultValue={item ? centsToInput(item.priceCents) : ""} required />
          </Field>
          <Field label="Custo" hint="Estimado ou de compra. A margem só aparece para o dono.">
            <input name="cost" className="field" defaultValue={item && item.costCents > 0 ? centsToInput(item.costCents) : ""} />
          </Field>
        </div>
        {type === "MATERIAL_SERVICE" ? (
          <Field label="Cobrança">
            <select name="billing" className="field" defaultValue={item?.billing ?? "PER_METER"}>
              <option value="PER_METER">Por metro</option>
              <option value="PER_SERVICE">Por serviço</option>
            </select>
          </Field>
        ) : null}
        <Field label="Ícone">
          <select name="icon" className="field" defaultValue={item?.icon ?? "sparkles"}>
            {ICONS.map((icon) => (
              <option key={icon.id} value={icon.id}>
                {icon.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-center gap-2 text-sm">
          <ServiceIcon name={item?.icon ?? "sparkles"} />
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="active" defaultChecked={item?.active ?? true} />
            Ativo
          </label>
        </div>
      </Panel>

      {type === "PACKAGE" ? (
        <Panel className="space-y-3">
          <h2 className="font-display text-lg">Serviços inclusos</h2>
          <Field label="Parceiro" hint="Deixe em branco se o pacote vale para qualquer cliente.">
            <select name="partnerId" className="field" defaultValue={item?.partnerId ?? ""}>
              <option value="">Nenhum</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>
          </Field>
          <ul className="space-y-2">
            {services.map((service) => (
              <li key={service.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="componentId" value={service.id} defaultChecked={item?.componentIds.includes(service.id)} />
                  {service.name}
                </label>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {type === "RESALE" ? (
        <Panel className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria">
            <input name="category" className="field" defaultValue={item?.category ?? ""} />
          </Field>
          <Field label="Fornecedor">
            <input name="supplier" className="field" defaultValue={item?.supplier ?? ""} />
          </Field>
          <Field label="Unidade">
            <input name="unit" className="field" defaultValue={item?.unit ?? "un"} />
          </Field>
          <Field label="Estoque mínimo" hint="O controle de estoque entra na próxima fase.">
            <input name="minStock" className="field" defaultValue={item?.minStock ? String(item.minStock) : ""} />
          </Field>
        </Panel>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar item"}
      </Button>
    </form>
  );
}
