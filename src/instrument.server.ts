import * as Sentry from "@sentry/tanstackstart-react";
import { labelAiAgentSpan } from "@/lib/sentry/ai-chat";
import { getSentryOptions } from "@/lib/sentry/options";

Sentry.init({
  ...getSentryOptions({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  }),
  release: import.meta.env.VITE_BUILD_SHA,
});
Sentry.getClient()?.on("spanStart", labelAiAgentSpan);
