"use client";

import { useState } from "react";

export function PhotoField() {
  const [name, setName] = useState("Nenhum arquivo");
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">Arquivo</span>
      <span className="inline-flex cursor-pointer items-center gap-3 rounded-md border border-line bg-bg px-3 py-2 text-sm">
        Escolher foto
        <span className="text-muted">{name}</span>
        <input
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          className="sr-only"
          onChange={(event) => setName(event.target.files?.[0]?.name || "Nenhum arquivo")}
        />
      </span>
    </label>
  );
}
