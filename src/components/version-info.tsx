"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function VersionInfo({
  version,
  sha,
  formattedTime,
}: {
  version: string;
  sha: string;
  formattedTime: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon">
            <Info className="h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">Versjonsinfo</span>
          </Button>
        }
      />
      <PopoverContent
        side="right"
        sideOffset={16}
        align="end"
        className="w-auto"
      >
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          <span>v{version}</span>
          <span className="mx-1.5 text-border">·</span>
          <span className="text-brand/60">{sha}</span>
          <span className="mx-1.5 text-border">·</span>
          <span>{formattedTime}</span>
        </p>
      </PopoverContent>
    </Popover>
  );
}
