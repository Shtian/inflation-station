# Categories Route AGENTS

Load this when working in `src/app/categories`.

- Keep category/category-rule CRUD interactions in this route, backed by `/api/categories` and `/api/category-rules`.
- Keep shared scope-label and mutation-error helpers in `categories-manager.utils.ts`.
- Keep UI split into `components/category-management-section.tsx` and `components/rules-management-section.tsx`.
- Keep user-facing success/error feedback local to this route.
- Use Sonner `toast.success(...)` for successful category/category-rule CRUD feedback, while keeping blocking validation/API errors inline.
- For category form migrations, use shared `Field` primitives (`Field`, `FieldLabel`, `FieldContent`) and keep existing `Input`/`SelectTrigger` ids (including rename dialog ids) unchanged for accessible label wiring and stable tests.
