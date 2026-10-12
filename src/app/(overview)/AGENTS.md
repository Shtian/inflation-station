# Overview Route AGENTS

Load this when working in `src/app/(overview)`.

- Keep chart/filter state in route-local modules (prefer a dedicated hook).
- Fetch `/api/dashboard/analytics` on account/date filter changes so charts stay backend-aligned.
- Keep transfer-exclusion messaging visible in normal page flow on `/`.
- A successful `/api/accounts` load with zero accounts sends the user to `/onboarding` from `use-overview-dashboard.ts`. Keep that redirect client-side: the stubbed suite runs on an empty database and stubs `/api/accounts` in the browser, so a server redirect in `src/app/page.tsx` would bounce every dashboard spec.
