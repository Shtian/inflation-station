/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUILD_SHA: string;
  readonly VITE_BUILD_TIME: string;
  /** Empty when Sentry is not configured. */
  readonly VITE_SENTRY_DSN: string;
  /** Empty when unset; the Sentry options default it. */
  readonly VITE_SENTRY_ENVIRONMENT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
