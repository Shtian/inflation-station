import * as Sentry from "@sentry/tanstackstart-react";
import { ENV } from "varlock/env";
import { labelAiAgentSpan } from "@/lib/sentry/ai-chat";
import { getSentryOptions } from "@/lib/sentry/options";

Sentry.init({
  ...getSentryOptions({
    dsn: ENV.VITE_SENTRY_DSN,
    environment: ENV.VITE_SENTRY_ENVIRONMENT,
  }),
  release: import.meta.env.VITE_BUILD_SHA,
});
Sentry.getClient()?.on("spanStart", labelAiAgentSpan);
