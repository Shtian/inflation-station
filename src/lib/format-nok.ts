const nokFormatter = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeNokFormatter = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

type FormatNokOptions = { whole?: boolean };

export function formatNok(value: number, options?: FormatNokOptions): string {
  return (options?.whole ? wholeNokFormatter : nokFormatter).format(value);
}

export function formatSignedNok(
  value: number,
  mode: "positive" | "negative" | "auto" = "auto",
  options?: FormatNokOptions,
): string {
  const formatted = formatNok(Math.abs(value), options);

  if (mode === "positive") {
    return `+${formatted}`;
  }

  if (mode === "negative") {
    return `-${formatted}`;
  }

  return value < 0 ? `-${formatted}` : `+${formatted}`;
}
