export type DeckWorld = {
  background: string;
  foreground: string;
  accent: string;
  muted: string;
};

// Worlds are tints of the active theme palette (see globals.css), so the deck
// follows the selected palette and light/dark mode instead of fixed brights.
function tintWorld(
  surface: string,
  tintPercent: number,
  accentSource: string,
): DeckWorld {
  const background =
    tintPercent === 0
      ? "var(--background)"
      : `color-mix(in oklab, var(${surface}) ${tintPercent}%, var(--background))`;

  return {
    background,
    foreground: "var(--foreground)",
    accent: `color-mix(in oklab, var(${accentSource}) 78%, var(--foreground))`,
    muted: `color-mix(in oklab, var(--foreground) 70%, ${background})`,
  };
}

export const DECK_WORLDS = {
  base: tintWorld("--brand", 0, "--brand"),
  positive: tintWorld("--success", 12, "--success"),
  negative: tintWorld("--destructive", 11, "--destructive"),
  brand: tintWorld("--brand", 15, "--brand"),
  brandSoft: tintWorld("--brand", 7, "--brand"),
  neutral: tintWorld("--primary", 6, "--primary"),
  neutralDeep: tintWorld("--primary", 11, "--brand"),
} satisfies Record<string, DeckWorld>;
