import { Link, useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { TripDatePicker } from "@/app/trips/components/trip-date-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { TripSearchQuery } from "@/lib/trips/load";
import { TRIP_SEARCH_KEYS, type TripSearchParams } from "../-server";

/** A GET form, so the search lives in the URL and survives reload and back. */
export function TripSearchForm({
  tripId,
  query,
}: {
  tripId: string;
  query: TripSearchQuery | null;
}) {
  const navigate = useNavigate();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const search: TripSearchParams = {};
    for (const key of TRIP_SEARCH_KEYS) {
      const value = form.get(key);
      if (typeof value === "string") search[key] = value;
    }
    void navigate({
      to: "/trips/$tripId",
      params: { tripId },
      search,
      resetScroll: false,
    });
  }

  return (
    <form
      action={`/trips/${tripId}`}
      onSubmit={handleSubmit}
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
            to="/trips/$tripId"
            params={{ tripId }}
            resetScroll={false}
            className={buttonVariants({ variant: "ghost" })}
          >
            Nullstill
          </Link>
        ) : null}
      </div>
    </form>
  );
}
