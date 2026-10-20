import type { Metadata } from "next";
import { Alert, Button, Field, PageHeader, Panel } from "@/components/ui";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime, queryValue } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { saveSettings } from "@/server/settings-actions";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ salvo?: string }> }) {
  await requireRoles(["OWNER"]);
  const saved = queryValue((await searchParams).salvo) === "1";
  const [settings, audits] = await Promise.all([
    getSettings(),
    prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Textos do orçamento, Instagram, cidade e a chave Pix usada no fechamento."
      />
      {saved ? <Alert tone="success">Alterações salvas.</Alert> : null}
      <form action={saveSettings} className="max-w-2xl space-y-4">
        <Panel className="space-y-4">
          <Field label="Texto de apresentação">
            <textarea name="presentation" className="field min-h-28" defaultValue={settings.presentation} />
          </Field>
          <Field label="Texto de fechamento">
            <textarea name="closing" className="field min-h-24" defaultValue={settings.closing} />
          </Field>
          <Field label="Instagram" hint="Aparece no rodapé do PDF quando preenchido.">
            <input name="instagram" className="field" defaultValue={settings.instagram} placeholder="@kfdetail" />
          </Field>
          <Field label="Cidade">
            <input name="city" className="field" defaultValue={settings.city} />
          </Field>
          <Field label="Chave Pix da KF" hint="Entra no relatório de fechamento com o parceiro, na fase seguinte.">
            <input name="pixKey" className="field" defaultValue={settings.pixKey} />
          </Field>
        </Panel>
        <Button type="submit">Salvar</Button>
      </form>
      <Panel>
        <h2 className="font-display text-lg">Atividade importante</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {audits.map((audit) => (
            <li key={audit.id}>
              <span className="text-muted">{formatDateTime(audit.createdAt)}</span> · {audit.user?.name ?? "Sistema"} · {audit.action} · {audit.detail}
            </li>
          ))}
          {audits.length === 0 ? <li className="text-muted">Nenhuma alteração registrada ainda.</li> : null}
        </ul>
      </Panel>
    </div>
  );
}
