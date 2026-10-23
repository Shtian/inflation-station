import { describe, expect, it } from "vite-plus/test";
import type { JevOutcomeSummary } from "@/lib/categorization/jev-categorize";
import { describeJevUnavailability } from "./jev-unavailable-notice";

function outcomes(counts: Partial<JevOutcomeSummary>): JevOutcomeSummary {
  return {
    ok: 0,
    uncategorized: 0,
    below_floor: 0,
    disabled: 0,
    key_missing: 0,
    timeout: 0,
    provider_error: 0,
    ...counts,
  };
}

describe("describeJevUnavailability", () => {
  it("names the missing API key when every Jev row lacked one", () => {
    expect(describeJevUnavailability(outcomes({ key_missing: 37 }), 40)).toBe(
      "Automatisk kategorisering var utilgjengelig for 37 av 40 rader (API-nøkkel er ikke konfigurert).",
    );
  });

  it("sums unavailable rows across reasons and lists each reason once", () => {
    expect(
      describeJevUnavailability(
        outcomes({ ok: 5, timeout: 2, provider_error: 1 }),
        10,
      ),
    ).toBe(
      "Automatisk kategorisering var utilgjengelig for 3 av 10 rader (tidsavbrudd, feil hos leverandøren).",
    );
  });

  it("shows no notice when Jev answered every row it was asked about", () => {
    expect(
      describeJevUnavailability(
        outcomes({ ok: 3, uncategorized: 2, below_floor: 1 }),
        6,
      ),
    ).toBeNull();
    expect(describeJevUnavailability(outcomes({ ok: 3, disabled: 1 }), 4)).toBe(
      "Automatisk kategorisering var utilgjengelig for 1 av 4 rader (slått av i konfigurasjonen).",
    );
  });
});
