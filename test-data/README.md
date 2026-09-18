# Import test data

Sample CSV exports for manually testing `/import`, matching the two provider
mappings seeded by `prisma/seed.mjs` (Nordea, SpareBank 1). Both are detected
automatically (no manual provider selection needed).

- `nordea-sample.csv` — 10 rows, Nordea column headers.
- `sparebank1-sample.csv` — 8 rows, SpareBank 1 column headers.

Each file includes one exact duplicate pair (to see potential-duplicate
flagging) and one `reservert` booking date (to see it dropped as a pending
transaction). Merchant text is deliberately noisy (`REMA 1000 5062 OSLO NO`,
`VIPPS*JOKER MAJORSTUEN`, ...) so the message-cleanup chunk stream has
something worth cleaning up once uploaded — set `OPENAI_API_KEY` in `.env` to
see real suggestions stream in; without it, the review table correctly shows
cleanup as unavailable (`key_missing`).

Upload either file from the Import page against any seeded account.
