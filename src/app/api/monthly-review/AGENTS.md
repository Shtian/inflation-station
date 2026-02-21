# Monthly Review API AGENTS

Load this when working in `src/app/api/monthly-review`.

- Keep routes thin: validate payload/query and map errors consistently.
- Compose timeline responses via `src/lib/monthly-review/timeline.ts` with explicit review states.
- `/api/monthly-review/generate` should map invalid payload/month/server failures to stable errors and persist provider/key failures as `FAILED` states (`key_missing`, `timeout`, `provider_error`).
- `/api/monthly-review/system-prompt` should preserve fallback semantics for empty prompt values.
