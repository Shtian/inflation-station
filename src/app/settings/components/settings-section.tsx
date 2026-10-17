import { type ReactNode, useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h2
        id={headingId}
        className="px-1 font-medium text-muted-foreground text-sm"
      >
        {title}
      </h2>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  label,
  htmlFor,
  description,
  children,
  layout = "inline",
}: {
  label: string;
  htmlFor: string;
  description: string;
  children: ReactNode;
  layout?: "inline" | "stacked";
}) {
  const inline = layout === "inline";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 py-3",
        inline && "sm:flex-row sm:items-center sm:justify-between sm:gap-6",
      )}
    >
      <div className="min-w-0 space-y-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <div
        className={cn("flex flex-col gap-1.5", inline && "shrink-0 sm:w-64")}
      >
        {children}
      </div>
    </div>
  );
}

export function SettingsStatus({ children }: { children: ReactNode }) {
  return <p className="px-4 py-3 text-muted-foreground text-sm">{children}</p>;
}
