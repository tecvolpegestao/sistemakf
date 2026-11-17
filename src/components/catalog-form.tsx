"use client";

import { useActionState, useState } from "react";
import { saveCatalog } from "@/server/catalog-actions";
import { centsToInput } from "@/lib/format";
import { ICONS, TYPE_LABEL } from "@/lib/labels";
import type { FormState } from "@/lib/types";
import { ComboBox, fold } from "./combo-box";
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
  const [icon, setIcon] = useState(item?.icon ?? "sparkles");
  const [serviceQuery, setServiceQuery] = useState("");
  const visibleServices = services.filter((service) => {
    const query = serviceQuery.trim();
    if (!query) return true;
    return fold(service.name).includes(fold(query)) || item?.componentIds.includes(service.id);
  });

  return (
    <form action={action} className="max-w-2xl space-y-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Panel className="grid gap-4">
        <Field label="Tipo">
          <ComboBox
            name="type"
            ariaLabel="Tipo"
            value={type}
            onChange={setType}
            options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
          />
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
          <Field label="Custo" hint="Custo de compra do produto. A margem só aparece para o dono.">
            <input name="cost" className="field" defaultValue={item && item.costCents > 0 ? centsToInput(item.costCents) : ""} />
          </Field>
        </div>
        {type === "MATERIAL_SERVICE" ? (
          <Field label="Cobrança">
            <ComboBox
              name="billing"
              ariaLabel="Cobrança"
              defaultValue={item?.billing ?? "PER_METER"}
              options={[
                { value: "PER_METER", label: "Por metro" },
                { value: "PER_SERVICE", label: "Por serviço" },
              ]}
            />
          </Field>
        ) : null}
        <Field label="Ícone">
          <ComboBox
            name="icon"
            ariaLabel="Ícone"
            value={icon}
            onChange={setIcon}
            options={ICONS.map((entry) => ({ value: entry.id, label: entry.label }))}
          />
        </Field>
        <div className="flex items-center gap-2 text-sm">
          <ServiceIcon name={icon} />
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
            <ComboBox
              name="partnerId"
              ariaLabel="Parceiro"
              placeholder="Buscar parceiro"
              defaultValue={item?.partnerId ?? ""}
              options={[{ value: "", label: "Nenhum" }, ...partners.map((partner) => ({ value: partner.id, label: partner.name }))]}
            />
          </Field>
          <Field label="Buscar serviço">
            <input className="field" value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="Nome do serviço" />
          </Field>
          <ul className="space-y-2">
            {visibleServices.map((service) => (
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

      {type === "MATERIAL_SERVICE" || type === "RESALE" ? (
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
          <Field label="Estoque mínimo" hint="O estoque avisa quando a quantidade fica abaixo deste número.">
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
