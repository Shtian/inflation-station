import type { Fetch } from "@typesafe-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ColumnMapping } from "./column-mapping";
import {
  guessColumnMapping,
  resolveSavedColumnMapping,
} from "./guess-column-mapping";

const SPAREBANK_HEADERS = [
  "Dato",
  "Beløp",
  "Avsender",
  "Mottaker",
  "Beskrivelse",
];
const SPAREBANK_ROWS = [["15.01.2026", "-89,00", "", "Vy", "VY TOG OSLO S"]];

const DNB_HEADERS = [
  "Dato",
  "Forklaring",
  "Rentedato",
  "Ut fra konto",
  "Inn på konto",
];
const DNB_ROWS = [
  ["02.01.2026", "Kiwi Majorstuen", "02.01.2026", "249,90", ""],
  ["03.01.2026", "Lønn", "03.01.2026", "", "35 000,00"],
];

type JevAnswer = { choice: string; confidence: number };

function jevFetch(answerFor: (instructions: string) => JevAnswer) {
  return vi.fn(async (_input: unknown, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as {
      questions: { pick: { instructions: string } };
    };
    const { choice, confidence } = answerFor(body.questions.pick.instructions);

    return new Response(
      JSON.stringify({
        model: "jev-latest",
        answers: {
          pick: {
            type: "choice",
            choice,
            confidence,
            probabilities: { [choice]: confidence },
          },
        },
        usage: { input_tokens: 10, output_tokens: 2 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
}

describe("guessColumnMapping", () => {
  beforeEach(() => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the heuristic guess when Jev has no API key", async () => {
    const guess = await guessColumnMapping({
      headers: SPAREBANK_HEADERS,
      sampleRows: SPAREBANK_ROWS,
    });

    expect(guess).toEqual({
      mapping: {
        date: { index: 0, header: "Dato" },
        amount: { kind: "signed", column: { index: 1, header: "Beløp" } },
        description: [{ index: 4, header: "Beskrivelse" }],
        paymentType: null,
      },
      sources: {
        date: "heuristic",
        amount: "heuristic",
        description: "heuristic",
        paymentType: "none",
      },
    });
  });

  it("returns the heuristic guess when the Jev request fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const guess = await guessColumnMapping({
      headers: SPAREBANK_HEADERS,
      sampleRows: SPAREBANK_ROWS,
      jev: { apiKey: "test-key", fetchImpl: fetchImpl as unknown as Fetch },
    });

    expect(fetchImpl).toHaveBeenCalled();
    expect(guess.sources).toEqual({
      date: "heuristic",
      amount: "heuristic",
      description: "heuristic",
      paymentType: "none",
    });
  });

  it("lets a high-confidence Jev answer replace a field and ignores low-confidence and none answers", async () => {
    const fetchImpl = jevFetch((instructions) => {
      if (instructions.includes("booking date")) {
        return { choice: "column_0", confidence: 0.95 };
      }
      if (instructions.includes("signed amount")) {
        return { choice: "column_2", confidence: 0.5 };
      }
      if (instructions.includes("merchant")) {
        return { choice: "column_3", confidence: 0.9 };
      }
      return { choice: "none", confidence: 0.99 };
    });

    const guess = await guessColumnMapping({
      headers: SPAREBANK_HEADERS,
      sampleRows: SPAREBANK_ROWS,
      jev: { apiKey: "test-key", fetchImpl: fetchImpl as unknown as Fetch },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(guess).toEqual({
      mapping: {
        date: { index: 0, header: "Dato" },
        amount: { kind: "signed", column: { index: 1, header: "Beløp" } },
        description: [{ index: 3, header: "Mottaker" }],
        paymentType: null,
      },
      sources: {
        date: "jev",
        amount: "heuristic",
        description: "jev",
        paymentType: "none",
      },
    });
  });

  it("keeps a split amount and a multi-column description that Jev's single picks cannot express", async () => {
    const fetchImpl = jevFetch((instructions) =>
      instructions.includes("signed amount")
        ? { choice: "column_3", confidence: 0.97 }
        : { choice: "column_1", confidence: 0.97 },
    );

    const guess = await guessColumnMapping({
      headers: DNB_HEADERS,
      sampleRows: DNB_ROWS,
      jev: { apiKey: "test-key", fetchImpl: fetchImpl as unknown as Fetch },
    });

    expect(guess.mapping.amount).toEqual({
      kind: "split",
      inflow: { index: 4, header: "Inn på konto" },
      outflow: { index: 3, header: "Ut fra konto" },
    });
    expect(guess.mapping.description).toEqual([
      { index: 1, header: "Forklaring" },
    ]);
    expect(guess.sources.amount).toBe("heuristic");
    expect(guess.sources.description).toBe("heuristic");
  });
});

describe("resolveSavedColumnMapping", () => {
  const saved: ColumnMapping = {
    date: { index: 0, header: "Dato" },
    amount: {
      kind: "split",
      inflow: { index: 4, header: "Inn på konto" },
      outflow: { index: 3, header: "Ut fra konto" },
    },
    description: [{ index: 1, header: "Forklaring" }],
  };

  it("returns the saved mapping when the file's header signature matches", () => {
    expect(
      resolveSavedColumnMapping(
        {
          csvColumnMapping: saved,
          csvHeaderSignature: "dato|forklaring|rentedato|utfrakonto|innpakonto",
        },
        DNB_HEADERS,
      ),
    ).toEqual(saved);
  });

  it("ignores the saved mapping for a file with different headers", () => {
    expect(
      resolveSavedColumnMapping(
        {
          csvColumnMapping: saved,
          csvHeaderSignature: "dato|forklaring|rentedato|utfrakonto|innpakonto",
        },
        SPAREBANK_HEADERS,
      ),
    ).toBeNull();
  });

  it("ignores a stored mapping that no longer parses", () => {
    expect(
      resolveSavedColumnMapping(
        {
          csvColumnMapping: { date: "Dato" },
          csvHeaderSignature: "dato|forklaring|rentedato|utfrakonto|innpakonto",
        },
        DNB_HEADERS,
      ),
    ).toBeNull();
  });

  it("returns null for an account with nothing saved", () => {
    expect(
      resolveSavedColumnMapping(
        { csvColumnMapping: null, csvHeaderSignature: null },
        DNB_HEADERS,
      ),
    ).toBeNull();
  });
});
