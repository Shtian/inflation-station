# API Route AGENTS

Load this when working in `src/app/api`.

- Keep route handlers focused on payload/query validation and HTTP error mapping.
- Keep domain query/mutation logic in `src/lib/*` modules.
- For no-content responses, use `new Response(null, { status: 204 })` instead of `NextResponse.json`.
