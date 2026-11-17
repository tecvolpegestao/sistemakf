"use client";

import { useState } from "react";
import { buttonClass } from "./ui";

export function CopyButton({ text, label = "Copiar para o WhatsApp" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className={buttonClass("secondary")}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        window.setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? "Copiado" : label}
    </button>
  );
}
