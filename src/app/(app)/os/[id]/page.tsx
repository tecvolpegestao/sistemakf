import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { PhotoField } from "@/components/photo-field";
import { ServiceIcon } from "@/components/service-icon";
import { Alert, Button, ButtonLink, Field, PageHeader, Panel, PaymentBadge, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { asStatus, availableTransitions, canManage, canSeeCosts, canSeeMoney, lineTotalCents, priceBoxLabel, totalsOf } from "@/lib/domain";
import { centsToInput, formatBRL, formatDate, formatDateTime, formatNumber, formatPercent, queryValue, quoteSummary, todayInput, vehicleLine, whatsAppUrl } from "@/lib/format";
import { ATTACHMENT_LABEL, METHOD_LABEL, STATUS_ACTION } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { addAttachment, cancelOrder, registerPayment, removeAttachment, toggleStep, transitionOrder } from "@/server/order-actions";
import type { ServiceStatus } from "@/lib/types";

const PREFERRED_ACTION: Partial<Record<ServiceStatus, ServiceStatus>> = {
  QUOTE: "AWAITING_APPROVAL",
  AWAITING_APPROVAL: "APPROVED",
  APPROVED: "IN_PROGRESS",
  IN_PROGRESS: "READY",
  READY: "DELIVERED",
  REFUSED: "QUOTE",
};

function preferredAction(status: ServiceStatus) {
  return PREFERRED_ACTION[status];
}

export const metadata: Metadata = { title: "Ordem de serviço" };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const error = queryValue((await searchParams).erro);
  const order = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      client: true,
      vehicle: true,
      items: { orderBy: { sortOrder: "asc" }, include: { catalogItem: { include: { components: { include: { component: true } } } } } },
      steps: { orderBy: { sortOrder: "asc" }, include: { doneBy: true } },
      payments: { orderBy: { paidAt: "desc" }, include: { recordedBy: true } },
      events: { orderBy: { createdAt: "desc" } },
      attachments: { orderBy: { createdAt: "desc" } },
      createdBy: true,
      assignedTo: true,
    },
  });
  if (!order) notFound();
  if (user.role === "APPLICATOR" && order.assignedToId !== user.id) redirect("/os");

  const status = (asStatus(order.status) ?? "QUOTE") as ServiceStatus;
  const showMoney = canSeeMoney(user.role);
  const showCosts = canSeeCosts(user.role);
  const totals = totalsOf(order);
  const settings = await getSettings();
  const actions = availableTransitions(status, user.role).filter((item) => item !== "CANCELLED");
  const canEdit =
    canManage(user.role) &&
    !["CANCELLED", "REFUSED"].includes(status) &&
    (["QUOTE", "AWAITING_APPROVAL"].includes(status) || user.role === "OWNER");
  const summary = quoteSummary({
    number: order.number,
    clientName: order.client.name,
    vehicleLine: order.vehicle ? vehicleLine(order.vehicle) : "Veículo a definir",
    items: order.items.map((item) => ({
      name: item.name,
      detail: item.billing === "PER_METER" ? `${formatNumber(item.meters ?? 0)} m` : "",
    })),
    totalCents: totals.totalCents,
    priceLabel: priceBoxLabel(order.items),
  });
  const whatsApp = order.client.phone ? whatsAppUrl(order.client.phone, summary) : null;
  const closed = status === "CANCELLED" || status === "REFUSED";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`OS ${order.number}`}
        description={order.vehicle ? vehicleLine(order.vehicle) : order.client.name}
        actions={
          showMoney ? (
            <>
              <ButtonLink href={`/os/${order.id}/pdf`} variant="secondary">
                PDF
              </ButtonLink>
              <CopyButton text={summary} />
              {whatsApp ? (
                <ButtonLink href={whatsApp} variant="secondary">
                  WhatsApp
                </ButtonLink>
              ) : null}
              {canEdit ? (
                <ButtonLink href={`/os/${order.id}/editar`} variant="secondary">
                  Editar
                </ButtonLink>
              ) : null}
            </>
          ) : undefined
        }
      />
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        {showMoney ? <PaymentBadge status={totals.paymentStatus} /> : null}
        {order.assignedTo ? <span className="text-sm text-muted">Aplicador: {order.assignedTo.name}</span> : null}
      </div>
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((next) => (
            <form key={next} action={transitionOrder}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="to" value={next} />
              <Button type="submit" variant={next === preferredAction(status) ? "primary" : "secondary"}>
                {STATUS_ACTION[next]}
              </Button>
            </form>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="font-display text-lg">Cliente</h2>
          {showMoney ? (
            <Link className="mt-2 inline-block text-link" href={order.client.type === "PARTNER" ? `/parceiros/${order.clientId}` : `/clientes/${order.clientId}`}>
              {order.client.name}
            </Link>
          ) : (
            <p className="mt-2">{order.client.name}</p>
          )}
          {order.client.type === "PARTNER" ? <p className="text-sm text-muted">Parceiro</p> : null}
        </Panel>
        <Panel>
          <h2 className="font-display text-lg">Veículo</h2>
          {order.vehicle ? (
            showMoney ? (
              <Link className="mt-2 inline-block text-link" href={`/veiculos/${order.vehicle.id}`}>
                {vehicleLine(order.vehicle)}
              </Link>
            ) : (
              <p className="mt-2">{vehicleLine(order.vehicle)}</p>
            )
          ) : (
            <p className="mt-2 text-sm text-muted">Sem veículo.</p>
          )}
        </Panel>
      </div>

      <Panel>
        <h2 className="font-display text-lg">Itens</h2>
        <ul className="mt-3 divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3">
              <div className="flex gap-2">
                <ServiceIcon name={item.icon} className="mt-0.5 h-4 w-4 text-decorative" />
                <div>
                  <div className="font-medium">{item.name}</div>
                  {item.description ? <p className="text-sm text-muted">{item.description}</p> : null}
                  {item.catalogItem?.type === "PACKAGE" ? (
                    <p className="text-sm text-muted">{item.catalogItem.components.map((component) => component.component.name).join(" · ")}</p>
                  ) : null}
                  {item.billing === "PER_METER" ? <p className="text-xs text-muted">{formatNumber(item.meters ?? 0)} m</p> : null}
                </div>
              </div>
              {showMoney ? <span className="tabular-nums">{formatBRL(lineTotalCents(item))}</span> : null}
            </li>
          ))}
        </ul>
        {showMoney ? (
          <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
            <span className="text-sm text-muted">{priceBoxLabel(order.items)}</span>
            <span className="font-display text-2xl tabular-nums">{formatBRL(totals.totalCents)}</span>
          </div>
        ) : null}
        {order.notes ? <p className="mt-3 text-sm text-muted">{order.notes}</p> : null}
      </Panel>

      <Panel>
        <h2 className="font-display text-lg">Etapas</h2>
        <ul className="mt-2 divide-y divide-line">
          {order.steps.map((step) => (
            <li key={step.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <div className={step.done ? "text-muted line-through" : ""}>{step.name}</div>
                {step.done && step.doneAt ? (
                  <div className="text-xs text-muted">
                    {step.doneBy?.name ?? "Equipe"} · {formatDateTime(step.doneAt)}
                  </div>
                ) : null}
              </div>
              {!closed ? (
                <form action={toggleStep}>
                  <input type="hidden" name="stepId" value={step.id} />
                  <Button type="submit" variant="secondary">
                    {step.done ? "Reabrir" : "Concluir"}
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
          {order.steps.length === 0 ? <li className="py-2 text-sm text-muted">Sem etapas.</li> : null}
        </ul>
      </Panel>

      <Panel>
        <h2 className="font-display text-lg">Fotos</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {order.attachments.map((attachment) => (
            <figure key={attachment.id} className="overflow-hidden rounded-md border border-line bg-bg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment.path} alt="" className="h-32 w-full object-cover" />
              <figcaption className="flex items-center justify-between px-2 py-1 text-xs text-muted">
                {ATTACHMENT_LABEL[attachment.kind as keyof typeof ATTACHMENT_LABEL] ?? attachment.kind}
                {canManage(user.role) ? (
                  <form action={removeAttachment}>
                    <input type="hidden" name="attachmentId" value={attachment.id} />
                    <button type="submit" className="text-danger">
                      Remover
                    </button>
                  </form>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
        {!closed ? (
          <form action={addAttachment} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="hidden" name="orderId" value={order.id} />
            <Field label="Momento">
              <select name="kind" className="field" defaultValue="BEFORE">
                <option value="BEFORE">Antes</option>
                <option value="AFTER">Depois</option>
              </select>
            </Field>
            <PhotoField />
            <Button type="submit" variant="secondary">
              Anexar
            </Button>
          </form>
        ) : null}
      </Panel>

      {showCosts ? (
        <Panel>
          <h2 className="font-display text-lg">Financeiro</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted">Valor cobrado</dt>
              <dd className="tabular-nums">{formatBRL(totals.totalCents)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Custo estimado</dt>
              <dd className="tabular-nums">{totals.costCents > 0 ? formatBRL(totals.costCents) : "Ainda não informado"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Margem estimada</dt>
              <dd className="tabular-nums">{totals.costCents > 0 ? formatPercent(totals.margin) : "—"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            O custo real, com o consumo confirmado na ordem, entra na fase de estoque. Aqui o valor usa o custo do catálogo no momento do orçamento.
          </p>
        </Panel>
      ) : null}

      {showMoney && !closed ? (
        <Panel>
          <h2 className="font-display text-lg">Pagamento</h2>
          <p className="mt-1 text-sm text-muted">Saldo {formatBRL(totals.balanceCents)}</p>
          {totals.balanceCents > 0 ? (
            <form action={registerPayment} className="mt-3 grid gap-3 sm:grid-cols-4">
              <input type="hidden" name="orderId" value={order.id} />
              <Field label="Valor">
                <input name="amount" className="field" defaultValue={centsToInput(totals.balanceCents)} />
              </Field>
              <Field label="Forma">
                <select name="method" className="field" defaultValue="PIX">
                  {Object.entries(METHOD_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Data">
                <input name="paidAt" type="date" className="field" defaultValue={todayInput()} />
              </Field>
              <div className="flex items-end">
                <Button type="submit">Registrar</Button>
              </div>
            </form>
          ) : (
            <p className="mt-2 text-sm">Pagamento quitado.</p>
          )}
          <ul className="mt-4 divide-y divide-line text-sm">
            {order.payments.map((payment) => (
              <li key={payment.id} className="flex justify-between gap-3 py-2">
                <span>
                  {formatDate(payment.paidAt)} · {METHOD_LABEL[payment.method as keyof typeof METHOD_LABEL] ?? payment.method} · {payment.recordedBy.name}
                </span>
                <span className="tabular-nums">{formatBRL(payment.amountCents)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel>
        <h2 className="font-display text-lg">Linha do tempo</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {order.events.map((event) => (
            <li key={event.id}>
              <span className="text-muted">{formatDateTime(event.createdAt)}</span> · {event.message}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Criada por {order.createdBy.name} em {formatDateTime(order.createdAt)}.
          {settings.city ? ` ${settings.city}.` : ""}
        </p>
      </Panel>

      {canManage(user.role) && availableTransitions(status, user.role).includes("CANCELLED") ? (
        <Panel>
          <h2 className="font-display text-lg">Cancelar</h2>
          <p className="mt-1 text-sm text-muted">O cancelamento pede motivo e permanece no histórico. Ordem paga só o dono cancela.</p>
          {order.cancelReason ? <p className="mt-2 text-sm">{order.cancelReason}</p> : null}
          <form action={cancelOrder} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="orderId" value={order.id} />
            <input name="reason" className="field" placeholder="Motivo" required minLength={5} />
            <Button type="submit" variant="danger">
              Cancelar ordem
            </Button>
          </form>
        </Panel>
      ) : null}
      {status === "CANCELLED" && order.cancelReason ? <Alert>Cancelada: {order.cancelReason}</Alert> : null}
    </div>
  );
}
