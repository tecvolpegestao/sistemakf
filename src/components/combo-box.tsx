"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type ComboOption = {
  value: string;
  label: string;
  group?: string;
  keywords?: string;
};

export function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function ComboBox({
  name,
  value,
  defaultValue = "",
  onChange,
  options,
  placeholder = "Buscar",
  emptyLabel = "Nenhum resultado",
  ariaLabel,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  emptyLabel?: string;
  ariaLabel?: string;
}) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const selected = controlled ? value : internal;
  const selectedOption = options.find((option) => option.value === selected);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const needle = fold(query.trim());
    if (!needle) return options;
    return options.filter((option) => fold(`${option.label} ${option.keywords ?? ""} ${option.group ?? ""}`).includes(needle));
  }, [options, query]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  function commit(next: string) {
    if (!controlled) setInternal(next);
    onChange?.(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className={open ? "relative z-30" : "relative"}>
      {name ? <input type="hidden" name={name} value={selected} /> : null}
      <input
        className="field"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        placeholder={open ? placeholder : selectedOption?.label || placeholder}
        value={open ? query : (selectedOption?.label ?? "")}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setActive(0);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            const option = filtered[active];
            if (option) commit(option.value);
          } else if (event.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
      />
      {open ? (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-elevated py-1">
          {filtered.length === 0 ? <li className="px-3 py-2 text-sm text-muted">{emptyLabel}</li> : null}
          {filtered.map((option, index) => {
            const showGroup = Boolean(option.group) && option.group !== filtered[index - 1]?.group;
            return (
              <li key={`${option.group ?? ""}-${option.value}-${index}`}>
                {showGroup ? <div className="px-3 pb-1 pt-2 text-xs text-muted">{option.group}</div> : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === selected}
                  className={`block w-full px-3 py-2 text-left text-sm ${index === active || option.value === selected ? "bg-card text-link" : "text-ink"}`}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commit(option.value)}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
