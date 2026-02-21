# Components AGENTS

Load this when working in `src/components`.

- Manage light/dark mode via `theme-provider.tsx` (`next-themes`, html class strategy) and keep global toggle in `theme-toggle.tsx`.
- Reuse `route-loading-state.tsx` and `route-error-state.tsx` for route fallback UX.
- Use shared `CategoryCombobox` for import review, transaction edit, and category-rule flows; enable `showClear` when uncategorized is valid and keep keyboard-first selection behavior.
