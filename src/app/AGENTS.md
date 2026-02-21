# src/app AGENTS

Load this when working on App Router pages/layouts.

- Keep primary app navigation in `src/app/layout.tsx`.
- For major routes, include route-local `loading.tsx` and `error.tsx` and reuse `src/components/route-loading-state.tsx` + `src/components/route-error-state.tsx`.
- Avoid duplicate page/card headings and excessive nested bordered cards; for multi-section pages, prefer separators via `src/components/ui/separator.tsx`.
