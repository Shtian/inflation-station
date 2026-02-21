# Import Provider Mappings API AGENTS

Load this when working in `src/app/api/import-provider-mappings`.

- Manage provider mapping API handlers in this directory.
- Keep this collection route focused on list reads (`GET`); create mutations are handled by typed Server Actions.
- Block update requests when required canonical mapping fields are missing.
- Keep handlers focused on payload validation and error mapping.
