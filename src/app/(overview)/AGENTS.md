# Overview Route AGENTS

Load this when working in `src/app/(overview)`.

- Keep chart/filter state in route-local modules (prefer a dedicated hook).
- Fetch `/api/dashboard/analytics` on account/date filter changes so charts stay backend-aligned.
- Keep transfer-exclusion messaging visible in normal page flow on `/`.
