import { ENV } from "varlock/env";

// SENTRY_ENVIRONMENT is read at boot, so one image can serve several
// instances.
export function getSentryEnvironment(): string | undefined {
  return ENV.SENTRY_ENVIRONMENT;
}
