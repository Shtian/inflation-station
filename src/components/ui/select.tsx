import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-900 shadow-xs outline-none focus-visible:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-300",
        className,
      )}
      {...props}
    />
  );
}
