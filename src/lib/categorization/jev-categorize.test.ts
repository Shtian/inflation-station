import { PaymentType } from "@prisma/client";
import type { Fetch } from "@typesafe-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  categorizeRowsWithJev,
  type JevCategorizeRow,
  type JevCategoryOption,
  type JevOutcomeSummary,
} from "./jev-categorize";

function systemOneResponse(choice: string, confidence: number) {
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
}

function buildRow(overrides?: Partial<JevCategorizeRow>): JevCategorizeRow {
  return {
    rowNumber: 2,
    bookingDate: "2026-01-01",
    amountNok: 100,
    currency: "NOK",
    paymentType: PaymentType.CARD,
    sender: "Alice",
    recipient: "Shop A",
    name: "Groceries",
    title: "Friday",
    ...overrides,
  };
}

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

const categories: JevCategoryOption[] = [
  {
    id: "cat-groceries",
    name: "Groceries",
    classifierHint: "supermarket purchases",
  },
  { id: "cat-transport", name: "Transport", classifierHint: null },
];

describe("categorizeRowsWithJev", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds alternatives from every category plus the uncategorized sentinel", async () => {
    let capturedBody:
      | { questions: { pick: { criteria: Record<string, string | null> } } }
      | undefined;
    const fetchImpl = vi.fn(async (_input: unknown, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return systemOneResponse("uncategorized", 0.5);
    });

    await categorizeRowsWithJev({
      rows: [buildRow()],
      categories,
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(capturedBody?.questions.pick.criteria).toEqual({
      "cat-groceries": "Groceries: supermarket purchases",
      "cat-transport": "Transport",
      uncategorized: "none of the above categories fit this transaction.",
    });
  });

  it("returns a JEV suggestion when Jev picks a real category", async () => {
    const fetchImpl = vi.fn(async () =>
      systemOneResponse("cat-groceries", 0.91),
    );

    const result = await categorizeRowsWithJev({
      rows: [buildRow({ rowNumber: 7 })],
      categories,
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({
      suggestions: [
        {
          rowNumber: 7,
          categoryId: "cat-groceries",
          source: "JEV",
          confidence: 0.91,
        },
      ],
      outcomes: outcomes({ ok: 1 }),
    });
  });

  it("emits no suggestion when Jev picks uncategorized", async () => {
    const fetchImpl = vi.fn(async () =>
      systemOneResponse("uncategorized", 0.4),
    );

    const result = await categorizeRowsWithJev({
      rows: [buildRow()],
      categories,
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({
      suggestions: [],
      outcomes: outcomes({ uncategorized: 1 }),
    });
  });

  it("counts a real category below the confidence floor as below_floor, not a suggestion", async () => {
    const fetchImpl = vi.fn(async () =>
      systemOneResponse("cat-groceries", 0.05),
    );

    const result = await categorizeRowsWithJev({
      rows: [buildRow()],
      categories,
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({
      suggestions: [],
      outcomes: outcomes({ below_floor: 1 }),
    });
  });

  it("keeps a suggestion exactly at the confidence floor", async () => {
    const fetchImpl = vi.fn(async () =>
      systemOneResponse("cat-transport", 0.1),
    );

    const result = await categorizeRowsWithJev({
      rows: [buildRow({ rowNumber: 3 })],
      categories,
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({
      suggestions: [
        {
          rowNumber: 3,
          categoryId: "cat-transport",
          source: "JEV",
          confidence: 0.1,
        },
      ],
      outcomes: outcomes({ ok: 1 }),
    });
  });

  it("counts every row as key_missing when no API key is configured", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const fetchImpl = vi.fn();

    const result = await categorizeRowsWithJev({
      rows: [buildRow({ rowNumber: 2 }), buildRow({ rowNumber: 3 })],
      categories,
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({
      suggestions: [],
      outcomes: outcomes({ key_missing: 2 }),
    });
  });

  it("tallies one count per row across mixed outcomes", async () => {
    const responsesByTitle: Record<string, () => Response> = {
      groceries: () => systemOneResponse("cat-groceries", 0.8),
      transport: () => systemOneResponse("cat-transport", 0.3),
      unsure: () => systemOneResponse("cat-transport", 0.02),
      none: () => systemOneResponse("uncategorized", 0.6),
      broken: () =>
        new Response(JSON.stringify({ error: "bad request" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
    };
    const fetchImpl = vi.fn(async (_input: unknown, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as {
        state: { title: string };
      };
      return responsesByTitle[body.state.title]();
    });

    const result = await categorizeRowsWithJev({
      rows: [
        buildRow({ rowNumber: 2, title: "groceries" }),
        buildRow({ rowNumber: 3, title: "transport" }),
        buildRow({ rowNumber: 4, title: "unsure" }),
        buildRow({ rowNumber: 5, title: "none" }),
        buildRow({ rowNumber: 6, title: "broken" }),
        buildRow({ rowNumber: 7, title: "broken" }),
      ],
      categories,
      concurrency: 1,
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({
      suggestions: [
        {
          rowNumber: 2,
          categoryId: "cat-groceries",
          source: "JEV",
          confidence: 0.8,
        },
        {
          rowNumber: 3,
          categoryId: "cat-transport",
          source: "JEV",
          confidence: 0.3,
        },
      ],
      outcomes: outcomes({
        ok: 2,
        below_floor: 1,
        uncategorized: 1,
        provider_error: 2,
      }),
    });
  });

  it("emits no suggestion and does not throw when the Jev call is unavailable", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "boom" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    );

    const result = await categorizeRowsWithJev({
      rows: [buildRow()],
      categories,
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({
      suggestions: [],
      outcomes: outcomes({ provider_error: 1 }),
    });
  });

  it("short-circuits to an empty result without calling fetch for empty rows", async () => {
    const fetchImpl = vi.fn();

    const result = await categorizeRowsWithJev({
      rows: [],
      categories,
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({ suggestions: [], outcomes: outcomes({}) });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("short-circuits to an empty result without calling fetch for empty categories", async () => {
    const fetchImpl = vi.fn();

    const result = await categorizeRowsWithJev({
      rows: [buildRow()],
      categories: [],
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual({ suggestions: [], outcomes: outcomes({}) });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("bounds in-flight calls at the configured concurrency while still processing every row", async () => {
    const concurrency = 3;
    const rows = Array.from({ length: 7 }, (_, index) =>
      buildRow({ rowNumber: index + 2, title: `row-${index}` }),
    );

    let inFlight = 0;
    let maxInFlight = 0;
    const pendingReleases: Array<() => void> = [];

    const fetchImpl = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise<void>((resolve) => {
        pendingReleases.push(resolve);
      });
      inFlight -= 1;
      return systemOneResponse("uncategorized", 0.5);
    });

    async function flushMicrotasks(times = 20) {
      for (let i = 0; i < times; i += 1) {
        await Promise.resolve();
      }
    }

    const resultPromise = categorizeRowsWithJev({
      rows,
      categories,
      concurrency,
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    let releasedCount = 0;
    while (releasedCount < rows.length) {
      await flushMicrotasks();
      const batch = pendingReleases.splice(0, pendingReleases.length);
      expect(batch.length).toBeGreaterThan(0);
      expect(batch.length).toBeLessThanOrEqual(concurrency);
      releasedCount += batch.length;
      for (const release of batch) {
        release();
      }
    }

    await resultPromise;

    expect(maxInFlight).toBeLessThanOrEqual(concurrency);
    expect(fetchImpl).toHaveBeenCalledTimes(rows.length);
  });
});
