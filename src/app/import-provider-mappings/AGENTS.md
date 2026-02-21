# Import Provider Mappings Route AGENTS

Load this when working in `src/app/import-provider-mappings`.

- Keep provider mapping CRUD interactions and user feedback in this route.
- Keep add/edit dialogs and mappings table/actions in focused components under `components/*`.
- Reuse a shared field-mappings editor across create/edit flows.
- Keep normalization rules parsing/building and field-mapping validation helpers in `provider-mappings-manager.utils.ts` for testable reuse.
- During staged Server Action migration, move create-mutation submissions to typed actions while keeping list refresh via `loadMappings()` against existing GET route for parity.
