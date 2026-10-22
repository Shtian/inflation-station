import { VersionInfo } from "@/components/version-info";

const buildTime = import.meta.env.VITE_BUILD_TIME;

// The time only shows in the popover, which mounts in the browser after
// hydration, so a server and browser that format it differently cannot
// cause a hydration mismatch.
const formattedTime = buildTime
  ? new Intl.DateTimeFormat("nb-NO", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Oslo",
    }).format(new Date(buildTime))
  : "ukjent";

/** Start copy of `@/components/build-info`. Self-update on Start is not wired yet, so it passes no start function. */
export function BuildInfo() {
  return (
    <VersionInfo
      sha={import.meta.env.VITE_BUILD_SHA || "unknown"}
      formattedTime={formattedTime}
    />
  );
}
