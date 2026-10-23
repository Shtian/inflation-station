# API Route AGENTS

Load this when working in `src/routes/api`.

- Each endpoint is a server route: `createFileRoute("/api/...")({ server: { handlers: { GET, POST, ..., ANY } } })`. Handlers take `{ request, params }` and return a `Response` (`Response.json(...)`). Keep the `ANY` handler answering 405 so an unsupported method gets a status code instead of the HTML app.
- Keep route handlers focused on payload/query validation and HTTP error mapping.
- Keep domain query/mutation logic in `src/lib/*` modules.
- Validate `YYYY-MM-DD` query params with `parseIsoDate` from `@/lib/iso-date`; a shape-only regex silently rolls an impossible day such as `2026-02-31` into the next month.
- For no-content responses, use `new Response(null, { status: 204 })`.
- Test a route beside it in `<route>.test.ts`. Get a callable handler with `routeHandler(Route, "POST")` from `-route-handler.ts` and call it with a `Request` and the path params.
