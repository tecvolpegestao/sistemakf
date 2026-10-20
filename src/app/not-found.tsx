import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-start justify-center px-6">
      <p className="text-sm text-muted">404</p>
      <h1 className="mt-2 font-display text-3xl">Página não encontrada</h1>
      <ButtonLink href="/" className="mt-6" variant="secondary">
        Voltar ao painel
      </ButtonLink>
    </main>
  );
}
