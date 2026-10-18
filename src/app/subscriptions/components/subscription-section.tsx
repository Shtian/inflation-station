import type { ReactNode } from "react";

type SubscriptionSectionProps = {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function SubscriptionSection({
  id,
  title,
  description,
  children,
}: SubscriptionSectionProps) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="space-y-1">
        <h2 id={id} className="font-semibold text-foreground text-lg">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function EmptySectionText({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}
