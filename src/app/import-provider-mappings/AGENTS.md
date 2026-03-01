# Import Provider Mappings Route AGENTS

Load this when working in `src/app/import-provider-mappings`.

- Keep provider mapping CRUD interactions and user feedback in this route.
- Keep add/edit dialogs and mappings table/actions in focused components under `components/*`.
- Reuse a shared field-mappings editor across create/edit flows.
- Keep normalization rules parsing/building and field-mapping validation helpers in `provider-mappings-manager.utils.ts` for testable reuse.
- Submit create mutations through typed Server Actions, while keeping list refreshes on `loadMappings()` against the existing GET route for parity.
- Keep edit/delete on the existing `/api/import-provider-mappings/[providerMappingId]` endpoints until those mutations are explicitly migrated.
- Use Sonner toasts for successful provider mapping create/edit/delete outcomes in `provider-mappings-manager.tsx`, while keeping validation and API failures inline (dialog-level or route-level alerts).
- For Field primitive migrations in provider mapping dialogs, keep existing input ids (`new-*` / `edit-*`) and wrap controls with `Field` + `FieldContent` so `FieldLabel htmlFor` wiring and E2E selectors stay stable.
- In `provider-mapping-string-badge-input.tsx`, use `FieldError` for validator feedback and keep Enter-to-add behavior unchanged for regex/header badge inputs.
