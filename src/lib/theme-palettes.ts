export const THEME_PALETTES = [
  { id: "default", label: "Ember" },
  { id: "ocean", label: "Ocean" },
  { id: "forest", label: "Forest" },
  { id: "plum", label: "Plum" },
] as const;

export type PaletteId = (typeof THEME_PALETTES)[number]["id"];

export const DEFAULT_PALETTE_ID: PaletteId = "default";

export const PALETTE_STORAGE_KEY = "inflation-station-palette";

const PALETTE_IDS: readonly string[] = THEME_PALETTES.map(
  (palette) => palette.id,
);

export function parsePaletteId(value: unknown): PaletteId {
  return typeof value === "string" && PALETTE_IDS.includes(value)
    ? (value as PaletteId)
    : DEFAULT_PALETTE_ID;
}

// Runs before first paint so a stored palette never flashes the default.
export const PALETTE_BOOT_SCRIPT = `(function(){var d=${JSON.stringify(DEFAULT_PALETTE_ID)},v=d;try{var s=localStorage.getItem(${JSON.stringify(PALETTE_STORAGE_KEY)});if(${JSON.stringify(PALETTE_IDS)}.indexOf(s)>-1)v=s}catch(e){}document.documentElement.dataset.palette=v})()`;
