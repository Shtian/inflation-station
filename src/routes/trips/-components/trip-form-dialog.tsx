import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  type FormEvent,
  type ReactElement,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { TripDatePicker } from "@/app/trips/components/trip-date-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Trip } from "@/lib/trips/summary";
import { createTripFn, updateTripFn } from "../-server";

type FieldName = "name" | "startDate" | "endDate";
type FieldErrors = Partial<Record<FieldName, string[]>>;

type TripFormDialogProps = {
  /** Omit to create a trip; pass one to edit it. */
  trip?: Trip;
  trigger: ReactElement;
};

function toForm(trip: Trip | undefined): Record<FieldName, string> {
  return {
    name: trip?.name ?? "",
    startDate: trip?.startDate ?? "",
    endDate: trip?.endDate ?? "",
  };
}

function readFieldErrors(details: unknown): FieldErrors {
  if (
    typeof details === "object" &&
    details !== null &&
    "fieldErrors" in details
  ) {
    return details.fieldErrors as FieldErrors;
  }
  return {};
}

export function TripFormDialog({ trip, trigger }: TripFormDialogProps) {
  const router = useRouter();
  const navigate = useNavigate();
  const createTrip = useServerFn(createTripFn);
  const updateTrip = useServerFn(updateTripFn);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toForm(trip));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setForm(toForm(trip));
      setFieldErrors({});
      setFormError(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSaving(async () => {
      const result = trip
        ? await updateTrip({ data: { tripId: trip.id, ...form } })
        : await createTrip({ data: form });

      if (!result.ok) {
        setFieldErrors(readFieldErrors(result.error.details));
        setFormError(result.error.message);
        return;
      }

      await router.invalidate();
      setOpen(false);
      toast.success(trip ? "Turen er oppdatert." : "Turen er opprettet.");
      if (!trip) {
        await navigate({
          to: "/trips/$tripId",
          params: { tripId: result.data.id },
        });
      }
    });
  }

  const fields: { name: FieldName; label: string }[] = [
    { name: "name", label: "Navn" },
    { name: "startDate", label: "Startdato" },
    { name: "endDate", label: "Sluttdato" },
  ];

  function setField(name: FieldName, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{trip ? "Rediger tur" : "Ny tur"}</DialogTitle>
          <DialogDescription>
            {trip
              ? "Endre navn eller datoer. Transaksjonene på turen beholdes."
              : "Gi turen et navn og velg datoene. Etterpå velger du hvilke transaksjoner som hører til."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {fields.map((field) => (
            <Field
              key={field.name}
              data-invalid={Boolean(fieldErrors[field.name])}
            >
              <FieldLabel htmlFor={`trip-${field.name}`}>
                {field.label}
              </FieldLabel>
              <FieldContent>
                {field.name === "name" ? (
                  <Input
                    id="trip-name"
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.name)}
                    disabled={saving}
                    required
                  />
                ) : (
                  <TripDatePicker
                    id={`trip-${field.name}`}
                    value={form[field.name]}
                    onValueChange={(value) => setField(field.name, value)}
                    defaultMonth={
                      field.name === "endDate" ? form.startDate : undefined
                    }
                    aria-invalid={Boolean(fieldErrors[field.name])}
                    disabled={saving}
                  />
                )}
                <FieldError
                  errors={fieldErrors[field.name]?.map((message) => ({
                    message,
                  }))}
                />
              </FieldContent>
            </Field>
          ))}

          {formError && Object.keys(fieldErrors).length === 0 ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Lagrer…" : trip ? "Lagre endringer" : "Opprett tur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
