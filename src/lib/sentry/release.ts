/** The Sentry release that events, source maps, and deploys share. */
export function getSentryRelease(version: string, sha: string): string {
  return `inflation-station@${version}+${sha}`;
}
