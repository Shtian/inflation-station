"use client";

import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { useState } from "react";
import { nb } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TripDatePickerProps = {
  /** The trigger's id, so a `FieldLabel htmlFor` labels it. */
  id: string;
  /** Set inside a GET form; renders a hidden input carrying `yyyy-mm-dd`. */
  name?: string;
  /** Controlled value (`yyyy-mm-dd` or ""). Omit to let the picker hold it. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** `yyyy-mm-dd` whose month the calendar opens on when no day is selected. */
  defaultMonth?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
};

export function TripDatePicker({
  id,
  name,
  value,
  defaultValue = "",
  onValueChange,
  defaultMonth,
  disabled,
  "aria-invalid": ariaInvalid,
}: TripDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [ownValue, setOwnValue] = useState(defaultValue);
  const current = value ?? ownValue;
  const selected = current ? parseISO(current) : undefined;

  function select(date: Date | undefined) {
    const next = date ? format(date, "yyyy-MM-dd") : "";
    setOwnValue(next);
    onValueChange?.(next);
    setOpen(false);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-invalid={ariaInvalid}
              className={cn(
                "w-full justify-start bg-background text-left font-normal",
                !current && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selected
                ? format(selected, "dd.MM.yyyy", { locale: nb })
                : "Velg dato"}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={nb}
            selected={selected}
            defaultMonth={
              selected ?? (defaultMonth ? parseISO(defaultMonth) : undefined)
            }
            onSelect={select}
          />
        </PopoverContent>
      </Popover>
      {name ? <input type="hidden" name={name} value={current} /> : null}
    </>
  );
}
