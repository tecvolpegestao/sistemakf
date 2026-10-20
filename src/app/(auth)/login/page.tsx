import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex items-center justify-center bg-[#211F20] px-8 py-12">
        <div className="max-w-sm text-center">
          <BrandLogo className="mx-auto h-28" tone="on-dark" />
          <p className="mt-6 font-display text-sm tracking-wide text-[#A8A8A6]">Estética automotiva</p>
        </div>
      </section>
      <section className="flex items-center justify-center bg-bg px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-semibold">Entrar</h1>
          <p className="mt-1 mb-6 text-sm text-muted">Acesso da equipe KF Detail.</p>
          <LoginForm showDemo={process.env.NODE_ENV !== "production"} />
        </div>
      </section>
    </main>
  );
}
