# Transactions API AGENTS

Load this when working in `src/app/api/transactions`.

- Keep handlers focused on validation/error mapping and delegate domain logic to `src/lib/transactions/*`.
- In `/api/transactions/[transactionId]`, validate `transactionId` before mutation handlers.
- Map Prisma `P2025` to `TRANSACTION_NOT_FOUND` for both update and delete flows.
- Map Prisma `P2003` to a 404: `CATEGORY_OR_ACCOUNT_NOT_FOUND` on create (SQLite does not name the failing constraint) and `CATEGORY_NOT_FOUND` on update.
- In this folder, every mutation error response carries a human-readable `message` next to the stable `error` code; build validation messages with `formatPayloadErrorMessage`. The `/transactions` dialogs render `message` only, never the code.
- Include `categoryName` and `note` in list-row payloads used by `/transactions` table/edit flows.
- Keep transactions list query contract stable: `sorting` uses `<field>:<direction>`, empty text/id filters normalize to `undefined`, and `dateFrom`/`dateTo` must name a real calendar day or the request is a 400.
