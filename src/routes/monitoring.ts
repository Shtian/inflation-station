import * as Sentry from "@sentry/tanstackstart-react";
import { createFileRoute } from "@tanstack/react-router";

// With no allowlist, the tunnel only forwards envelopes for the DSN the server
// SDK was initialised with and rejects every other host or project.
export const Route = createFileRoute("/monitoring")({
  server: Sentry.createSentryTunnelRoute({}),
});
