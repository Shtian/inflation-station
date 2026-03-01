# Accounts Route AGENTS

Load this when working in `src/app/accounts`.

- Keep account load/create/edit/delete orchestration in `use-accounts-manager.ts`.
- Keep forms/tables in route-local section components under `components/*`.
- Keep user-facing success/error feedback local to this route.
- Use Sonner `toast.success(...)` for successful account CRUD feedback, and keep blocking validation/API errors inline in the page.
