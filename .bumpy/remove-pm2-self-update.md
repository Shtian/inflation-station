---
"inflation-station": minor
---

Removed the pm2 deploy path (`update.sh`, `ecosystem.config.js`) and the in-app Update button. Coolify is now the only supported way to self-host. `SENTRY_ENVIRONMENT` is the only source for the Sentry environment, so instances that still set `VITE_SENTRY_ENVIRONMENT` must switch to it.
