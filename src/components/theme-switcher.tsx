"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DEFAULT_PALETTE_ID,
  PALETTE_STORAGE_KEY,
  type PaletteId,
  parsePaletteId,
  THEME_PALETTES,
} from "@/lib/theme-palettes";
import { cn } from "@/lib/utils";

const MODES = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
] as const;

const PREVIEW_BARS = [
  "h-[45%] bg-chart-1",
  "h-[80%] bg-chart-2",
  "h-[60%] bg-chart-3",
  "h-full bg-chart-4",
  "h-[35%] bg-chart-5",
];

function subscribePalette(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-palette"],
  });
  return () => observer.disconnect();
}

function readPalette() {
  return parsePaletteId(document.documentElement.dataset.palette);
}

function readServerPalette() {
  return DEFAULT_PALETTE_ID;
}

function selectPalette(id: PaletteId) {
  document.documentElement.dataset.palette = id;
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, id);
  } catch {
    // Storage can be unavailable (private mode, quota); the palette still applies for this page.
  }
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const palette = useSyncExternalStore(
    subscribePalette,
    readPalette,
    readServerPalette,
  );

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="icon">
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 gap-4 p-3">
        <fieldset>
          <legend className="mb-2 font-medium text-muted-foreground text-xs">
            Mode
          </legend>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {MODES.map(({ id, label, Icon }) => (
              <label
                key={id}
                className="flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium text-muted-foreground text-xs transition-colors hover:text-foreground has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring/60"
              >
                <input
                  type="radio"
                  name="theme-mode"
                  value={id}
                  checked={theme === id}
                  onChange={() => setTheme(id)}
                  className="sr-only"
                />
                <Icon aria-hidden className="size-3.5" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 font-medium text-muted-foreground text-xs">
            Palette
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {THEME_PALETTES.map(({ id, label }) => {
              const checked = palette === id;
              return (
                <label
                  key={id}
                  className="group/palette flex cursor-pointer flex-col gap-1.5"
                >
                  <input
                    type="radio"
                    name="theme-palette"
                    value={id}
                    checked={checked}
                    onChange={() => selectPalette(id)}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      "rounded-md ring-offset-2 ring-offset-popover transition-shadow group-hover/palette:ring-1 group-hover/palette:ring-border group-has-focus-visible/palette:ring-2 group-has-focus-visible/palette:ring-ring/60",
                      checked &&
                        "ring-2 ring-foreground group-hover/palette:ring-2 group-hover/palette:ring-foreground",
                    )}
                  >
                    <PalettePreview id={id} />
                  </div>
                  <span className="flex items-center justify-between px-0.5 font-medium text-xs">
                    {label}
                    {checked ? (
                      <Check aria-hidden className="size-3.5" />
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}

function PalettePreview({ id }: { id: PaletteId }) {
  return (
    <div
      aria-hidden
      data-palette={id}
      className="flex h-[4.5rem] flex-col gap-1.5 overflow-hidden rounded-md border border-border bg-background p-1.5"
    >
      <div className="flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-brand" />
        <span className="h-1 w-7 rounded-full bg-foreground/80" />
        <span className="h-1 w-4 rounded-full bg-muted-foreground/50" />
        <span className="ml-auto h-2 w-5 rounded-sm bg-primary" />
      </div>
      <div className="flex flex-1 items-end gap-0.5 rounded-sm border border-border bg-card px-1.5 pt-1.5 pb-1">
        {PREVIEW_BARS.map((bar) => (
          <span key={bar} className={cn("flex-1 rounded-t-[1px]", bar)} />
        ))}
      </div>
    </div>
  );
}
