const nokFormatter = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNok(value: number): string {
  return nokFormatter.format(value);
}

export function formatSignedNok(
  value: number,
  mode: "positive" | "negative" | "auto" = "auto",
): string {
  const absValue = Math.abs(value);
  const formatted = formatNok(absValue);

  if (mode === "positive") {
    return `+${formatted}`;
  }

  if (mode === "negative") {
    return `-${formatted}`;
  }

  return value < 0 ? `-${formatted}` : `+${formatted}`;
}
