import { PaymentType } from "@prisma/client";
import type { Fetch } from "@typesafe-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import {
  categorizeRowsWithJev,
  type JevCategorizeRow,
  type JevCategoryOption,
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

const categories: JevCategoryOption[] = [
  {
    id: "cat-groceries",
    name: "Groceries",
    classifierHint: "supermarket purchases",
  },
  { id: "cat-transport", name: "Transport", classifierHint: null },
];

describe("categorizeRowsWithJev", () => {
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

    expect(result).toEqual([
      {
        rowNumber: 7,
        categoryId: "cat-groceries",
        source: "JEV",
        confidence: 0.91,
      },
    ]);
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

    expect(result).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledOnce();
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

    expect(result).toEqual([]);
  });

  it("short-circuits to an empty result without calling fetch for empty rows", async () => {
    const fetchImpl = vi.fn();

    const result = await categorizeRowsWithJev({
      rows: [],
      categories,
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("short-circuits to an empty result without calling fetch for empty categories", async () => {
    const fetchImpl = vi.fn();

    const result = await categorizeRowsWithJev({
      rows: [buildRow()],
      categories: [],
      fetchImpl: fetchImpl as unknown as Fetch,
    });

    expect(result).toEqual([]);
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
