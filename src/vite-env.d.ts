/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUILD_SHA: string;
  readonly VITE_BUILD_TIME: string;
  /** Unset when Sentry is not configured. */
  readonly VITE_SENTRY_DSN?: string;
  /** The Sentry options default it when unset. */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
