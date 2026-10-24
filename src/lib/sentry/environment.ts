import { ENV } from "varlock/env";

// SENTRY_ENVIRONMENT is read at boot, so one image can serve several
// instances. pm2 clones that only set the build-time var keep their name.
export function getSentryEnvironment(): string | undefined {
  return ENV.SENTRY_ENVIRONMENT || ENV.VITE_SENTRY_ENVIRONMENT;
}
