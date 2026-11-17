import type { Metadata } from "next";
import { requireRoles } from "@/lib/auth";
import { canSeeCosts } from "@/lib/domain";
import { formatBRL, formatNumber, queryValue } from "@/lib/format";
import { loadStock } from "@/lib/inventory";
import { adjustStock, receiveStock } from "@/server/stock-actions";
import { ComboBox } from "@/components/combo-box";
import { Alert, Button, Field, PageHeader, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "Estoque" };

export default async function StockPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const user = await requireRoles(["OWNER", "ATTENDANT"]);
  const error = queryValue((await searchParams).erro);
  const owner = canSeeCosts(user.role);
  const rows = await loadStock();
  const active = rows.filter((row) => row.active);
  const options = active.map((row) => ({
    value: row.id,
    label: `${row.name} · ${formatNumber(row.quantity)} ${row.unit || "un"}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque"
        description="Entrada de PPF, película e produtos de revenda. O consumo na ordem e a venda avulsa baixam daqui."
      />
      {error ? <Alert>{error}</Alert> : null}
      {owner ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <h2 className="font-display text-lg">Entrada</h2>
            <form action={receiveStock} className="mt-3 grid gap-3">
              <Field label="Item">
                <ComboBox name="catalogItemId" ariaLabel="Item da entrada" placeholder="Buscar item" options={options} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Quantidade">
                  <input name="quantity" className="field" required />
                </Field>
                <Field label="Custo unitário" hint="Atualiza o custo médio do item.">
                  <input name="unitCost" className="field" placeholder="0,00" />
                </Field>
              </div>
              <Field label="Observação">
                <input name="note" className="field" />
              </Field>
              <Button type="submit">Registrar entrada</Button>
            </form>
          </Panel>
          <Panel>
            <h2 className="font-display text-lg">Ajuste</h2>
            <p className="mt-1 text-sm text-muted">Use quando a contagem física for diferente do sistema. O motivo fica no histórico.</p>
            <form action={adjustStock} className="mt-3 grid gap-3">
              <Field label="Item">
                <ComboBox name="catalogItemId" ariaLabel="Item do ajuste" placeholder="Buscar item" options={options} />
              </Field>
              <Field label="Quantidade contada">
                <input name="quantity" className="field" required />
              </Field>
              <Field label="Motivo">
                <input name="note" className="field" required minLength={5} />
              </Field>
              <Button type="submit" variant="secondary">
                Ajustar saldo
              </Button>
            </form>
          </Panel>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-card text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Saldo</th>
              <th className="px-3 py-2 text-right font-medium">Mínimo</th>
              {owner ? <th className="px-3 py-2 text-right font-medium">Custo médio</th> : null}
              <th className="px-3 py-2 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-3 py-3">
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-muted">{row.type === "RESALE" ? "Produto" : "Material"}</div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatNumber(row.quantity)} {row.unit || "un"}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-muted">{row.minStock > 0 ? formatNumber(row.minStock) : "—"}</td>
                {owner ? <td className="px-3 py-3 text-right tabular-nums">{row.averageCostCents > 0 ? formatBRL(row.averageCostCents) : "—"}</td> : null}
                <td className="px-3 py-3">{row.low ? <span className="text-warning">Abaixo do mínimo</span> : <span className="text-muted">Ok</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
