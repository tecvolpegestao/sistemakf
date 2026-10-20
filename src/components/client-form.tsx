"use client";

import { useActionState, useState } from "react";
import { saveClient } from "@/server/client-actions";
import type { FormState } from "@/lib/types";
import { Alert, Button, Field, Panel } from "./ui";

export function ClientForm({
  client,
  lockPartner = false,
}: {
  lockPartner?: boolean;
  client?: {
    id: string;
    name: string;
    phone: string;
    email: string;
    document: string;
    type: string;
    notes: string;
    tradeName: string;
    city: string;
    pixKey: string;
    logoPath: string;
  };
}) {
  const [state, action, pending] = useActionState(saveClient, null as FormState);
  const [type, setType] = useState(client?.type ?? (lockPartner ? "PARTNER" : "PRIVATE"));

  return (
    <form action={action} className="max-w-2xl space-y-4">
      {client ? <input type="hidden" name="id" value={client.id} /> : null}
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Panel className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <input name="name" className="field" defaultValue={client?.name ?? ""} required />
        </Field>
        <Field label="Telefone">
          <input name="phone" className="field" defaultValue={client?.phone ?? ""} />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" className="field" defaultValue={client?.email ?? ""} />
        </Field>
        <Field label="Documento">
          <input name="document" className="field" defaultValue={client?.document ?? ""} />
        </Field>
        <Field label="Tipo">
          <select name="type" className="field" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="PRIVATE">Particular</option>
            <option value="PARTNER">Parceiro</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Observações">
            <textarea name="notes" className="field min-h-24" defaultValue={client?.notes ?? ""} />
          </Field>
        </div>
      </Panel>
      {type === "PARTNER" ? (
        <Panel className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome fantasia">
            <input name="tradeName" className="field" defaultValue={client?.tradeName ?? ""} />
          </Field>
          <Field label="Cidade">
            <input name="city" className="field" defaultValue={client?.city ?? ""} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observação de pagamento" hint="A chave Pix da KF fica nas configurações e entra no fechamento.">
              <input name="pixKey" className="field" defaultValue={client?.pixKey ?? ""} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Logo" hint="Aparece no orçamento deste parceiro. PNG ou JPG.">
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="field" />
            </Field>
            {client?.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.logoPath} alt="" className="mt-3 h-12 w-auto" />
            ) : null}
          </div>
        </Panel>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
