import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { PAYMENT_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { PaymentStatus, ServiceStatus } from "@/lib/types";

const buttonStyles = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "border border-line bg-card text-ink hover:bg-elevated",
  ghost: "text-ink hover:bg-card",
  danger: "bg-danger-bg text-danger",
} as const;

export function buttonClass(variant: keyof typeof buttonStyles = "primary", className = "") {
  return `inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonStyles }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: keyof typeof buttonStyles;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Alert({ children, tone = "danger" }: { children: ReactNode; tone?: "danger" | "warning" | "success" }) {
  const toneClass =
    tone === "warning" ? "bg-warning-bg text-warning" : tone === "success" ? "bg-success-bg text-success" : "bg-danger-bg text-danger";
  return (
    <div role="alert" className={`rounded-md px-3 py-2 text-sm ${toneClass}`}>
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-lg">{title}</p>
      {children ? <div className="mt-2 text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-line bg-card p-4 ${className}`}>{children}</section>;
}

const statusTone: Record<ServiceStatus, string> = {
  QUOTE: "bg-bg text-muted",
  AWAITING_APPROVAL: "bg-warning-bg text-warning",
  APPROVED: "bg-info-bg text-info",
  IN_PROGRESS: "bg-info-bg text-info",
  READY: "bg-success-bg text-success",
  DELIVERED: "bg-success-bg text-success",
  REFUSED: "bg-danger-bg text-danger",
  CANCELLED: "bg-danger-bg text-danger",
};

export function StatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusTone[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone =
    status === "PAID" ? "bg-success-bg text-success" : status === "PARTIAL" ? "bg-warning-bg text-warning" : "bg-bg text-muted";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{PAYMENT_LABEL[status]}</span>;
}

export function Stat({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string;
  href?: string;
  hint?: string;
}) {
  const body = (
    <div className="rounded-lg border border-line bg-card p-4 transition hover:border-ink/30">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link">
      {body}
    </Link>
  );
}
