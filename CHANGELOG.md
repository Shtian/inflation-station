# Changelog



## 0.4.0
<sub>2026-10-25</sub>

- *(minor)*
  Removed the pm2 deploy path (`update.sh`, `ecosystem.config.js`) and the in-app Update button. Coolify is now the only supported way to self-host. `SENTRY_ENVIRONMENT` is the only source for the Sentry environment, so instances that still set `VITE_SENTRY_ENVIRONMENT` must switch to it.
- *(minor)*
  The Feedback widget now files issues through the GitHub REST API instead of the `gh` CLI, so it works in the Docker image. Set `FEEDBACK_GITHUB_TOKEN` to a fine-grained token with Issues read and write on `FEEDBACK_GITHUB_REPO`. Without the token, the widget stays hidden.
- *(patch)*
  The Coolify deploy poller now calls the deploy API with POST. Current Coolify versions reject GET with HTTP 405, so the poller never deployed. Reinstall `/usr/local/bin/inflation-station-deploy-poller` from `scripts/coolify/deploy-poller.sh` on the VM.

## 0.3.0
<sub>2026-10-25</sub>

- *(minor)*
  Added a `/api/health` endpoint and an image health check, so Coolify keeps the running version when a new one can't reach its database.

## 0.2.0
<sub>2026-10-24</sub>

- *(minor)* Versioned releases with bumpy. Each release gets a semver version, a changelog entry, a git tag and a GitHub release.
- *(minor)* Each release publishes a Docker image to GHCR, and a poller on the Coolify VM deploys it.
