# Import Route AGENTS

Load this when working in `src/app/import`.

- Keep statement upload (CSV or PDF) and account selection UI in this route, and stage parse results before persistence. The drop handler does not filter by type; `/api/imports/parse` decides the format from the upload's leading bytes.
- Keep parse/submit orchestration and per-row decision transitions in `use-import-workflow.ts`.
- Keep `import-uploader.tsx` focused on route orchestration: choosing the upload, column-mapping or review phase.
- A CSV whose account has no saved mapping for its headers goes through `components/import-column-mapping-phase.tsx` before review. Confirm saves the mapping with `saveAccountCsvColumnMappingAction`, then re-posts the file with `columnMapping`; a failed save warns through a toast and does not block the import. The preview there runs `parseMappedCsv` on the sample rows in the browser, so keep that module free of server-only imports.
- Keep the mapping controls' accessible names stable: the `Kolonnekobling` list with one expandable row per field; inside a row, the `Datokolonne`, `Beløpskolonne`, `Kolonne for penger inn`, `Kolonne for penger ut` and `Betalingstypekolonne` radio groups or the `Beskrivelseskolonner` checkbox group, each control named by its header; and the `Bekreft kobling` / `Rediger kolonnekobling` buttons.
- Keep upload/review rendering in focused components under `src/app/import/components/*`.
- The review step renders shared `TableWidthToggle` (`storageKey="import-review-table-width"`) only when `parseResult.review` exists; `import-uploader.tsx` lifts the `max-w-6xl` cap and the message cell relaxes its `20ch` truncation with the `full-width:` variant, so do not thread width state through props.
- Message cleanup settings live on `/settings`; see `src/app/settings/AGENTS.md`.
- During import upload Field migrations, keep `account-select` on `SelectTrigger` and `statement-file` on the hidden file input while pairing both with `FieldLabel htmlFor` so combobox/file-input accessible names and E2E selectors remain stable. The input's accessible name is `Kontoutskrift`, not `CSV-fil`; the route accepts CSV and PDF, so naming it after one format tells screen-reader users the wrong thing.
- Preserve row-specific accessible names for controls (for example `Kategori for rad N`, `Bytt meldingskilde for rad N`, `Notat for rad N`).
- After successful `/api/imports/submit`, clear client review/file state and show concise summary feedback.
- For import route feedback, keep blocking parse/submit errors inline and emit successful submit summaries through Sonner toasts from `use-import-workflow.ts`.
