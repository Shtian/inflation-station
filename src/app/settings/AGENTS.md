# Settings Route AGENTS

Load this when working in `src/app/settings`.

- `/settings` is the only settings page, reached from the sidebar footer `Innstillinger` link. Add a new setting as a row in an existing section, or a new feature's settings as a `components/*-settings-section.tsx`, not as a route under the feature.
- Build sections from `SettingsSection` and `SettingsRow` in `components/settings-section.tsx`. Use `layout="inline"` for a select or switch and `layout="stacked"` for a textarea with its save button.
- Each section component owns its own fetch, save and feedback state, and shows its loading state inside its card with `SettingsStatus`.
- Emit save success through Sonner toasts and keep load and save failures as inline `role="alert"` text inside the section.
- Keep control ids and label text stable (`message-cleanup-openai-model`, `message-cleanup-reasoning-effort`, `message-cleanup-system-prompt`, `monthly-review-openai-model`, `monthly-review-system-prompt`). `SettingsRow` renders the `<label htmlFor>`, so pass the control's id as `htmlFor`.
- Message cleanup saves through `updateMessageCleanupSettingsAction` (a Server Action), wrapped in `try/catch` so transport failures still show the save error copy and re-enable controls. Monthly review saves with `PUT /api/monthly-review/system-prompt`. Both actions revalidate `/settings`.
- Both sections render a `Lagre prompt` button. E2E specs scope it by section region, e.g. `page.getByRole("region", { name: "Import", exact: true })`.
