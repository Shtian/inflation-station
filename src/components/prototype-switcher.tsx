"use client";

// PROTOTYPE — throwaway. Floating bar for flipping between ?variant= layouts.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

type PrototypeSwitcherProps = {
  variants: { key: string; name: string }[];
  current: string;
  onChange: (key: string) => void;
};

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: PrototypeSwitcherProps) {
  const position = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current),
  );

  const go = (step: number) => {
    const next =
      variants[(position + step + variants.length) % variants.length];
    const params = new URLSearchParams(window.location.search);
    params.set("variant", next.key);
    window.history.replaceState(null, "", `?${params}`);
    onChange(next.key);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, [contenteditable], [role=listbox]")
      ) {
        return;
      }
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const active = variants[position];

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-fuchsia-600 px-2 py-1.5 text-sm text-white shadow-xl ring-2 ring-white/40">
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => go(-1)}
        className="rounded-full p-1 hover:bg-white/20"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-48 text-center font-medium">
        PROTOTYPE · {active.key} ({active.name})
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => go(1)}
        className="rounded-full p-1 hover:bg-white/20"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
