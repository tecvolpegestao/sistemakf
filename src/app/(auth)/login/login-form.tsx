"use client";

import { useActionState } from "react";
import { loginAction } from "@/server/auth-actions";
import type { FormState } from "@/lib/types";
import { Alert, Button, Field } from "@/components/ui";

export function LoginForm({ showDemo }: { showDemo: boolean }) {
  const [state, action, pending] = useActionState(loginAction, null as FormState);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Field label="E-mail">
        <input name="email" type="email" autoComplete="username" className="field" required />
      </Field>
      <Field label="Senha">
        <input name="password" type="password" autoComplete="current-password" className="field" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Entrando..." : "Entrar"}
      </Button>
      {showDemo ? (
        <p className="text-xs leading-5 text-muted">
          Demonstração: victor@kfdetail.com.br, atendimento@kfdetail.com.br ou aplicador@kfdetail.com.br. Senha: kfdetail.
        </p>
      ) : null}
    </form>
  );
}
