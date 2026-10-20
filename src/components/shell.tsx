"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Search,
  Settings,
  Store,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/server/auth-actions";
import { ROLE_LABEL } from "@/lib/labels";
import type { SessionUser } from "@/lib/types";
import { BrandLogo } from "./brand-logo";
import { ThemeToggle } from "./theme-toggle";

const NAV: { href: string; label: string; icon: LucideIcon; roles: SessionUser["role"][]; group: string }[] = [
  { href: "/", label: "Painel", icon: LayoutDashboard, roles: ["OWNER", "ATTENDANT", "APPLICATOR"], group: "Operação" },
  { href: "/os", label: "Ordens de serviço", icon: ClipboardList, roles: ["OWNER", "ATTENDANT", "APPLICATOR"], group: "Operação" },
  { href: "/clientes", label: "Clientes", icon: Users, roles: ["OWNER", "ATTENDANT"], group: "Operação" },
  { href: "/parceiros", label: "Parceiros", icon: Store, roles: ["OWNER", "ATTENDANT"], group: "Operação" },
  { href: "/catalogo", label: "Catálogo", icon: Library, roles: ["OWNER", "ATTENDANT"], group: "Comercial" },
  { href: "/recebimentos", label: "Recebimentos", icon: CircleDollarSign, roles: ["OWNER", "ATTENDANT"], group: "Comercial" },
  { href: "/a-receber", label: "A receber", icon: CircleDollarSign, roles: ["OWNER", "ATTENDANT"], group: "Comercial" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, roles: ["OWNER"], group: "Sistema" },
];

export function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((item) => item.roles.includes(user.role));
  const groups = ["Operação", "Comercial", "Sistema"].filter((group) => items.some((item) => item.group === group));

  return (
    <div className="min-h-screen bg-bg">
      {open ? (
        <button type="button" className="fixed inset-0 z-30 bg-ink/40 md:hidden" aria-label="Fechar menu" onClick={() => setOpen(false)} />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-card transition-transform md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" aria-label="KF Detail" onClick={() => setOpen(false)}>
            <BrandLogo className="h-14" />
          </Link>
          <button type="button" className="md:hidden" aria-label="Fechar" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group}>
              <div className="px-3 pb-1 text-xs font-medium tracking-wide text-muted">{group}</div>
              <ul className="space-y-1">
                {items
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-2 rounded-md border-l-2 px-3 py-2 text-sm ${active ? "border-link text-link" : "border-transparent text-ink hover:bg-bg"}`}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-xs text-muted">{ROLE_LABEL[user.role]}</div>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </button>
          </form>
        </div>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-bg/95 px-4 backdrop-blur md:px-8">
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-card md:hidden" aria-label="Abrir menu" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <form action="/busca" className="relative mx-auto w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-decorative" aria-hidden="true" />
            <input name="q" className="field pl-9" placeholder="Placa, cliente ou número da OS" aria-label="Buscar" />
          </form>
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
