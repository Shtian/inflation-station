import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { parsePaletteId, THEME_PALETTES } from "./theme-palettes";

describe("parsePaletteId", () => {
  it("keeps known palette ids", () => {
    expect(parsePaletteId("ocean")).toBe("ocean");
    expect(parsePaletteId("botanical")).toBe("botanical");
    expect(parsePaletteId("plum")).toBe("plum");
    expect(parsePaletteId("default")).toBe("default");
  });

  it("falls back to default for anything else", () => {
    expect(parsePaletteId("sunset")).toBe("default");
    expect(parsePaletteId("Ocean")).toBe("default");
    expect(parsePaletteId(null)).toBe("default");
    expect(parsePaletteId(undefined)).toBe("default");
    expect(parsePaletteId(3)).toBe("default");
  });
});

const PALETTE_TOKENS = [
  "--accent",
  "--accent-foreground",
  "--background",
  "--border",
  "--brand",
  "--brand-foreground",
  "--card",
  "--card-foreground",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--foreground",
  "--input",
  "--muted",
  "--muted-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--ring",
  "--secondary",
  "--secondary-foreground",
  "--sidebar",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-ring",
].sort();

function readRules() {
  const css = readFileSync(
    path.resolve(__dirname, "../app/globals.css"),
    "utf8",
  );
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, head, body]) => ({
    selectors: head.split(",").map((selector) => selector.trim()),
    properties: [...body.matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name),
  }));
}

function propertiesFor(selector: string) {
  const rule = readRules().find((candidate) =>
    candidate.selectors.includes(selector),
  );
  return rule ? [...rule.properties].sort() : null;
}

describe("globals.css palette blocks", () => {
  for (const { id } of THEME_PALETTES) {
    it(`declares ${id} for light and dark`, () => {
      const light = propertiesFor(`[data-palette="${id}"]`);
      const dark = propertiesFor(`.dark [data-palette="${id}"]`);

      expect(light).toEqual(expect.arrayContaining(PALETTE_TOKENS));
      expect(dark).toEqual(expect.arrayContaining(PALETTE_TOKENS));
      if (id !== "default") {
        expect(light).toEqual(PALETTE_TOKENS);
        expect(dark).toEqual(PALETTE_TOKENS);
        expect(propertiesFor(`.dark[data-palette="${id}"]`)).toEqual(
          PALETTE_TOKENS,
        );
      }
    });
  }
});
