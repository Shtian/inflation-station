import { SelfUpdateButton } from "@/components/self-update-button";

export function BuildInfoFooter() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown";
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME;

  const formattedTime = buildTime
    ? new Intl.DateTimeFormat("nb-NO", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Oslo",
      }).format(new Date(buildTime))
    : "ukjent";

  return (
    <footer className="mt-auto border-border border-t px-5 py-3 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-3">
        <p className="font-mono text-muted-foreground text-xs tabular-nums">
          <span className="text-brand/60">{sha}</span>
          <span className="mx-1.5 text-border">·</span>
          <span>{formattedTime}</span>
        </p>
        {process.env.SELF_UPDATE_ROOT ? (
          <SelfUpdateButton pageSha={sha} />
        ) : null}
      </div>
    </footer>
  );
}
