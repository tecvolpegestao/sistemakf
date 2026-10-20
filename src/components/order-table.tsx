import Link from "next/link";
import { formatBRL, formatDate } from "@/lib/format";
import type { PaymentStatus, ServiceStatus } from "@/lib/types";
import { Empty, PaymentBadge, StatusBadge } from "./ui";

export type OrderRow = {
  id: string;
  number: number;
  status: ServiceStatus;
  paymentStatus: PaymentStatus;
  totalCents: number;
  createdAt: Date;
  clientName: string;
  vehicle: string;
};

export function OrderTable({ rows, showMoney }: { rows: OrderRow[]; showMoney: boolean }) {
  if (rows.length === 0) {
    return <Empty title="Nenhuma ordem neste filtro" />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="bg-card text-left text-xs text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">OS</th>
            <th className="px-3 py-2 font-medium">Veículo</th>
            <th className="px-3 py-2 font-medium">Cliente</th>
            <th className="px-3 py-2 font-medium">Serviço</th>
            {showMoney ? <th className="px-3 py-2 font-medium">Pagamento</th> : null}
            {showMoney ? <th className="px-3 py-2 text-right font-medium">Valor</th> : null}
            <th className="px-3 py-2 font-medium">Data</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-line hover:bg-card">
              <td className="px-3 py-3">
                <Link href={`/os/${row.id}`} className="font-medium text-link">
                  {row.number}
                </Link>
              </td>
              <td className="px-3 py-3">{row.vehicle || "—"}</td>
              <td className="px-3 py-3">{row.clientName}</td>
              <td className="px-3 py-3">
                <StatusBadge status={row.status} />
              </td>
              {showMoney ? (
                <td className="px-3 py-3">
                  <PaymentBadge status={row.paymentStatus} />
                </td>
              ) : null}
              {showMoney ? <td className="px-3 py-3 text-right tabular-nums">{formatBRL(row.totalCents)}</td> : null}
              <td className="px-3 py-3 tabular-nums text-muted">{formatDate(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
