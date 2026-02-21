# Transactions API AGENTS

Load this when working in `src/app/api/transactions`.

- Keep handlers focused on validation/error mapping and delegate domain logic to `src/lib/transactions/*`.
- In `/api/transactions/[transactionId]`, validate `transactionId` before mutation handlers.
- Map Prisma `P2025` to `TRANSACTION_NOT_FOUND` for both update and delete flows.
- Include `categoryName` and `note` in list-row payloads used by `/transactions` table/edit flows.
