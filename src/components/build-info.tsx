import { VersionInfo } from "@/components/version-info";

export function BuildInfo() {
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
    <VersionInfo
      sha={sha}
      formattedTime={formattedTime}
      selfUpdateEnabled={Boolean(process.env.SELF_UPDATE_ROOT)}
    />
  );
}
