# Components AGENTS

Load this when working in `src/components`.

- Theme has two axes. Mode (light/dark/system) belongs to `next-themes` in `theme-provider.tsx` (html class). Palette is `data-palette` on `<html>`, listed in `src/lib/theme-palettes.ts` and applied before paint by the boot script in `layout.tsx`. `theme-switcher.tsx` edits both.
- Palette colors live only in `globals.css`. A palette's light and dark blocks declare the same custom properties (`theme-palettes.test.ts` enforces this) and never override `success`, `warning`, or `destructive`.
- Sidebar collapse is `data-sidebar` on `<html>`, set before paint by `SIDEBAR_BOOT_SCRIPT` (`src/lib/sidebar-state.ts`) like the palette; style collapse with `in-data-[sidebar=...]` variants, not React state.
- Reuse `route-loading-state.tsx` and `route-error-state.tsx` for route fallback UX.
- Use shared `CategoryCombobox` for import review, transaction edit, and category-rule flows; enable `showClear` when uncategorized is valid and keep keyboard-first selection behavior.
