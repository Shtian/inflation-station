---
"inflation-station": patch
---

The Coolify deploy poller now calls the deploy API with POST. Current Coolify versions reject GET with HTTP 405, so the poller never deployed. Reinstall `/usr/local/bin/inflation-station-deploy-poller` from `scripts/coolify/deploy-poller.sh` on the VM.
