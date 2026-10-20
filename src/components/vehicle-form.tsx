"use client";

import { useActionState } from "react";
import { saveVehicle } from "@/server/client-actions";
import type { FormState } from "@/lib/types";
import { Alert, Button, Field, Panel } from "./ui";

export function VehicleForm({
  clients,
  vehicle,
}: {
  clients: { id: string; name: string }[];
  vehicle?: {
    id: string;
    clientId: string;
    plate: string;
    brand: string;
    model: string;
    year: number | null;
    color: string;
    notes: string;
  };
}) {
  const [state, action, pending] = useActionState(saveVehicle, null as FormState);
  return (
    <form action={action} className="max-w-2xl space-y-4">
      {vehicle ? <input type="hidden" name="id" value={vehicle.id} /> : null}
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Panel className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Cliente">
            <select name="clientId" className="field" defaultValue={vehicle?.clientId ?? clients[0]?.id ?? ""}>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Placa">
          <input name="plate" className="field uppercase" defaultValue={vehicle?.plate ?? ""} required />
        </Field>
        <Field label="Cor">
          <input name="color" className="field" defaultValue={vehicle?.color ?? ""} />
        </Field>
        <Field label="Marca">
          <input name="brand" className="field" defaultValue={vehicle?.brand ?? ""} required />
        </Field>
        <Field label="Modelo">
          <input name="model" className="field" defaultValue={vehicle?.model ?? ""} required />
        </Field>
        <Field label="Ano">
          <input name="year" className="field" inputMode="numeric" defaultValue={vehicle?.year ?? ""} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Observações">
            <textarea name="notes" className="field min-h-20" defaultValue={vehicle?.notes ?? ""} />
          </Field>
        </div>
      </Panel>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar veículo"}
      </Button>
    </form>
  );
}
