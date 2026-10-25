# Changelog


## 0.3.0
<sub>2026-10-25</sub>

- *(minor)*
  Added a `/api/health` endpoint and an image health check, so Coolify keeps the running version when a new one can't reach its database.

## 0.2.0
<sub>2026-10-24</sub>

- *(minor)* Versioned releases with bumpy. Each release gets a semver version, a changelog entry, a git tag and a GitHub release.
- *(minor)* Each release publishes a Docker image to GHCR, and a poller on the Coolify VM deploys it.
