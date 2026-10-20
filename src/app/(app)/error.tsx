"use client";

import { Button } from "@/components/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="font-display text-2xl">Não foi possível abrir esta tela</h1>
      <p className="mt-2 text-sm text-muted">Tente de novo. Se continuar, recarregue a página.</p>
      <Button type="button" className="mt-6" onClick={() => reset()}>
        Tentar de novo
      </Button>
    </div>
  );
}
