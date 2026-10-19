import Form from "next/form";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { TripSearchQuery } from "@/lib/trips/load";
import { TripDatePicker } from "./trip-date-picker";

/** A GET form, so the search lives in the URL and survives reload and back. */
export function TripSearchForm({
  tripId,
  query,
}: {
  tripId: string;
  query: TripSearchQuery | null;
}) {
  return (
    <Form
      action={`/trips/${tripId}`}
      scroll={false}
      className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] sm:items-end"
    >
      <Field>
        <FieldLabel htmlFor="trip-search-q">
          Brukersted, notat eller kategori
        </FieldLabel>
        <Input
          id="trip-search-q"
          name="q"
          type="search"
          defaultValue={query?.text ?? ""}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="trip-search-fra">Fra</FieldLabel>
        <TripDatePicker
          id="trip-search-fra"
          name="fra"
          defaultValue={query?.from ?? ""}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="trip-search-til">Til</FieldLabel>
        <TripDatePicker
          id="trip-search-til"
          name="til"
          defaultValue={query?.to ?? ""}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="trip-search-belop">Beløp</FieldLabel>
        <Input
          id="trip-search-belop"
          name="belop"
          inputMode="decimal"
          defaultValue={query?.amountNok ?? ""}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit">Søk</Button>
        {query ? (
          <Link
            href={`/trips/${tripId}`}
            scroll={false}
            className={buttonVariants({ variant: "ghost" })}
          >
            Nullstill
          </Link>
        ) : null}
      </div>
    </Form>
  );
}
