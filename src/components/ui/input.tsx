import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-900 shadow-xs outline-none placeholder:text-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-300",
        className,
      )}
      {...props}
    />
  );
}
