"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { SelfUpdateDialog, useSelfUpdate } from "@/components/self-update";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function VersionInfo({
  sha,
  formattedTime,
  selfUpdateEnabled,
}: {
  sha: string;
  formattedTime: string;
  selfUpdateEnabled: boolean;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { availability, availableSha, dialogOpen, setDialogOpen } =
    useSelfUpdate(selfUpdateEnabled);

  function openUpdateDialog() {
    setPopoverOpen(false);
    setDialogOpen(true);
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="icon" className="relative">
              <Info className="h-[1.2rem] w-[1.2rem]" />
              {availableSha === null ? null : (
                <span
                  aria-hidden
                  className="absolute top-1 right-1 size-1.5 rounded-full bg-brand"
                />
              )}
              <span className="sr-only">
                {availableSha === null
                  ? "Versjonsinfo"
                  : "Versjonsinfo, oppdatering tilgjengelig"}
              </span>
            </Button>
          }
        />
        <PopoverContent
          side="right"
          sideOffset={16}
          align="end"
          className="w-auto"
        >
          <p className="font-mono text-muted-foreground text-xs tabular-nums">
            <span className="text-brand/60">{sha}</span>
            <span className="mx-1.5 text-border">·</span>
            <span>{formattedTime}</span>
          </p>
          {selfUpdateEnabled ? (
            <Button
              variant="outline"
              size="xs"
              className={
                availableSha === null
                  ? "self-start font-mono"
                  : "self-start font-mono text-brand"
              }
              onClick={openUpdateDialog}
            >
              {availableSha === null ? null : (
                <span aria-hidden className="size-1.5 rounded-full bg-brand" />
              )}
              {availableSha === null ? "Oppdater" : "Oppdatering tilgjengelig"}
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
      {selfUpdateEnabled ? (
        <SelfUpdateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          pageSha={sha}
          availability={availability}
        />
      ) : null}
    </>
  );
}
