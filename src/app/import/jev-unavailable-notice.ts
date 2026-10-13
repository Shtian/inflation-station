import type { JevOutcomeSummary } from "@/lib/categorization/jev-categorize";
import type { JevUnavailableReason } from "@/lib/jev/client";

const UNAVAILABLE_REASON_TEXT: Record<JevUnavailableReason, string> = {
  disabled: "slått av i konfigurasjonen",
  key_missing: "API-nøkkel er ikke konfigurert",
  timeout: "tidsavbrudd",
  provider_error: "feil hos leverandøren",
};

const UNAVAILABLE_REASONS = Object.keys(
  UNAVAILABLE_REASON_TEXT,
) as JevUnavailableReason[];

export function describeJevUnavailability(
  outcomes: JevOutcomeSummary | undefined,
  totalRows: number,
): string | null {
  if (!outcomes) {
    return null;
  }

  const reasons = UNAVAILABLE_REASONS.filter((reason) => outcomes[reason] > 0);
  const unavailableRows = reasons.reduce(
    (sum, reason) => sum + outcomes[reason],
    0,
  );

  if (unavailableRows === 0) {
    return null;
  }

  const reasonText = reasons
    .map((reason) => UNAVAILABLE_REASON_TEXT[reason])
    .join(", ");
  return `Automatisk kategorisering var utilgjengelig for ${unavailableRows} av ${totalRows} rader (${reasonText}).`;
}
