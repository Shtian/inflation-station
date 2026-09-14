# API Route AGENTS

Load this when working in `src/app/api`.

- Keep route handlers focused on payload/query validation and HTTP error mapping.
- Keep domain query/mutation logic in `src/lib/*` modules.
- Validate `YYYY-MM-DD` query params with `parseIsoDate` from `@/lib/iso-date`; a shape-only regex silently rolls an impossible day such as `2026-02-31` into the next month.
- For no-content responses, use `new Response(null, { status: 204 })` instead of `NextResponse.json`.
