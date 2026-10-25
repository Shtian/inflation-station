---
"inflation-station": patch
---

The release workflow sends Docker image build timings to Sentry again: `image.build.duration`, `image.duration` and an `image.completed` counter, each tagged with the release and an `outcome`. They replace the deploy metrics that went away with `update.sh`.
