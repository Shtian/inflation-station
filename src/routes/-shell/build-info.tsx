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

/** Start copy of `@/components/build-info`. */
export function BuildInfo() {
  return (
    <VersionInfo
      version={import.meta.env.VITE_APP_VERSION}
      sha={import.meta.env.VITE_BUILD_SHA || "unknown"}
      formattedTime={formattedTime}
    />
  );
}
