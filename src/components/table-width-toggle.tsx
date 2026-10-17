"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TableWidth = "contained" | "full";

function parseTableWidth(value: string | null): TableWidth {
  return value === "full" ? "full" : "contained";
}

export function TableWidthToggle({ storageKey }: { storageKey: string }) {
  const [width, setWidth] = useState<TableWidth>("contained");
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setWidth(parseTableWidth(localStorage.getItem(storageKey)));
    setHasHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    // Writing before hydration would overwrite the stored choice with the default.
    if (!hasHydrated) {
      return;
    }

    localStorage.setItem(storageKey, width);
  }, [storageKey, width, hasHydrated]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="hidden xl:inline-flex"
              aria-label="Full bredde"
              aria-pressed={width === "full"}
              data-table-width={width}
              onClick={() =>
                setWidth((current) =>
                  current === "full" ? "contained" : "full",
                )
              }
            >
              {width === "full" ? (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          }
        />
        <TooltipContent side="top">
          {width === "full" ? "Bruk standard bredde" : "Bruk full bredde"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
