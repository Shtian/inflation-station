# Import Route AGENTS

Load this when working in `src/app/import`.

- Keep CSV upload/account selection UI in this route and stage parse results before persistence.
- Keep parse/submit orchestration and per-row decision transitions in `use-import-workflow.ts`.
- Keep `import-uploader.tsx` focused on route orchestration + provider dialog state.
- Keep upload/review rendering in focused components under `src/app/import/components/*`.
- Keep import settings save mutations in route-local client managers via typed Server Actions while preserving existing user-facing success/error copy.
- In import settings managers, emit save success feedback through Sonner toasts and keep save/load failures as inline alerts.
- During import settings Field migrations, keep existing control ids on `SelectTrigger`/`Textarea` and pair them with `FieldLabel htmlFor` so label wiring and test selectors stay stable.
- During import upload Field migrations, keep `account-select` on `SelectTrigger` and `csv-file` on the hidden file input while pairing both with `FieldLabel htmlFor` so combobox/file-input accessible names and E2E selectors remain stable.
- Wrap import-settings Server Action calls in `try/catch` so transport/protocol failures still resolve to the existing user-facing save error copy and re-enable controls.
- Preserve row-specific accessible names for controls (for example `Category for row N`, `Toggle message source for row N`, `Note for row N`).
- After successful `/api/imports/submit`, clear client review/file state and show concise summary feedback.
- For import route feedback, keep blocking parse/submit errors inline and emit successful submit summaries through Sonner toasts from `use-import-workflow.ts`.
