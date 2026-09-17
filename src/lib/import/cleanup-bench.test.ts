import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { describe, it } from "vitest";
import { buildOpenAiMessageCleanup } from "./openai-message-cleanup";

// Latency benchmark, not an assertion. Skipped unless CLEANUP_BENCH=1 so it
// never runs in CI or `pnpm test:unit`.
//   CLEANUP_BENCH=1 OPENAI_API_KEY=sk-... pnpm exec vitest run src/lib/import/cleanup-bench.test.ts
const ENABLED = process.env.CLEANUP_BENCH === "1";

const MODEL = process.env.BENCH_MODEL ?? "gpt-5.4-nano";
const ROW_COUNT = Number.parseInt(process.env.BENCH_ROWS ?? "300", 10);
const CHUNK_SIZE = Number.parseInt(process.env.BENCH_CHUNK ?? "25", 10);
// Distinct messages to spread across BENCH_ROWS. Set below BENCH_ROWS to model
// a repeat rate; only then does the dedupe variant have anything to remove.
const DISTINCT_COUNT = Number.parseInt(
  process.env.BENCH_DISTINCT ?? String(ROW_COUNT),
  10,
);
const SYSTEM_PROMPT =
  "You clean transaction messages. Return strict JSON with top-level suggestions only.";

const MERCHANT_TEMPLATES = [
  "REMA 1000 STORO        OSLO",
  "KIWI 447 SANDAKER      OSLO",
  "COOP EXTRA GRUNERLOKKA OSLO",
  "VIPPS*ANNA HANSEN",
  "NETTHANDEL ZALANDO SE  BERLIN DE",
  "VINMONOPOLET 0312      OSLO",
  "RUTER AS BILLETT APP   OSLO",
  "CIRCLE K ULLEVAAL      OSLO",
  "SPOTIFY P2C4F9A1B      STOCKHOLM SE",
  "APOTEK 1 STORO         OSLO",
  "MCDONALDS STORGATA     OSLO",
  "TELENOR NORGE AS FAKTURA",
  "BUNNPRIS & GURMET      OSLO",
  "ELKJOP NORDRE          LORENSKOG",
  "NARVESEN 7481 JERNBANETORGET",
];

type BenchRow = { rowNumber: number; message: string };

function buildRows(count: number): BenchRow[] {
  return Array.from({ length: count }, (_, index) => {
    const variant = index % DISTINCT_COUNT;
    const template = MERCHANT_TEMPLATES[variant % MERCHANT_TEMPLATES.length];
    const day = String((variant % 28) + 1).padStart(2, "0");
    const ref = String(100000 + variant * 37).slice(0, 6);
    return {
      rowNumber: index + 2,
      message: `${template} ${day}.03 KL. 14:22 REF ${ref}`,
    };
  });
}

function buildUserPrompt(rows: BenchRow[]): string {
  return JSON.stringify(
    {
      instructions: [
        "Clean and normalize noisy transaction message text.",
        "Do not invent details not present in the original message.",
        "Keep suggestions concise and user-readable.",
        "Return only rows you can improve.",
        "Return strict JSON with top-level suggestions only.",
      ],
      rows,
      outputFormat: {
        suggestions: [{ rowNumber: 1, cleanedMessage: "normalized message" }],
      },
    },
    null,
    2,
  );
}

type CallResult = { suggestions: number; outputTokens: number };

async function callOnce(
  apiKey: string,
  rows: BenchRow[],
  providerOptions?: Record<string, Record<string, string>>,
): Promise<CallResult> {
  const openai = createOpenAI({ apiKey });
  const result = await generateText({
    model: openai.chat(MODEL),
    maxRetries: 0,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(rows),
    ...(providerOptions ? { providerOptions } : {}),
  });

  const firstBrace = result.text.indexOf("{");
  const lastBrace = result.text.lastIndexOf("}");
  const parsed = JSON.parse(result.text.slice(firstBrace, lastBrace + 1)) as {
    suggestions?: unknown[];
  };

  return {
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions.length
      : 0,
    outputTokens: result.usage.outputTokens ?? 0,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

const MINIMAL_REASONING = {
  openai: { reasoningEffort: "minimal", textVerbosity: "low" },
};

type VariantResult = {
  suggestions: number;
  requests: number;
  outputTokens: number;
};

async function runChunked(
  apiKey: string,
  rows: BenchRow[],
  providerOptions?: Record<string, Record<string, string>>,
): Promise<VariantResult> {
  const batches = chunk(rows, CHUNK_SIZE);
  const results = await Promise.all(
    batches.map((batch) => callOnce(apiKey, batch, providerOptions)),
  );
  return {
    suggestions: results.reduce((sum, result) => sum + result.suggestions, 0),
    requests: batches.length,
    outputTokens: results.reduce((sum, result) => sum + result.outputTokens, 0),
  };
}

const VARIANTS: Record<
  string,
  (apiKey: string, rows: BenchRow[]) => Promise<VariantResult>
> = {
  // Calls the shipped module so the baseline is the real code path.
  "A-current-shipped": async (apiKey, rows) => {
    const result = await buildOpenAiMessageCleanup({
      apiKey,
      rows,
      model: MODEL,
    });
    if (result.unavailableReason) {
      throw new Error(`baseline unavailable: ${result.unavailableReason}`);
    }
    return {
      suggestions: result.suggestions.length,
      requests: 1,
      outputTokens: 0,
    };
  },

  "B-single-minimal-reasoning": async (apiKey, rows) => ({
    ...(await callOnce(apiKey, rows, MINIMAL_REASONING)),
    requests: 1,
  }),

  "C-parallel-chunks": (apiKey, rows) => runChunked(apiKey, rows),

  "D-parallel-chunks-minimal-reasoning": (apiKey, rows) =>
    runChunked(apiKey, rows, MINIMAL_REASONING),

  "E-dedupe-then-parallel-chunks": (apiKey, rows) => {
    const firstRowByMessage = new Map<string, number>();
    for (const row of rows) {
      if (!firstRowByMessage.has(row.message)) {
        firstRowByMessage.set(row.message, row.rowNumber);
      }
    }
    const unique = [...firstRowByMessage].map(([message, rowNumber]) => ({
      rowNumber,
      message,
    }));
    return runChunked(apiKey, unique, MINIMAL_REASONING);
  },
};

describe.skipIf(!ENABLED)("message cleanup latency", () => {
  it(
    "compares variants",
    async () => {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is required to run the benchmark.");
      }

      const rows = buildRows(ROW_COUNT);
      const distinct = new Set(rows.map((row) => row.message)).size;
      console.log(
        `\nmodel=${MODEL} rows=${ROW_COUNT} distinct=${distinct} chunk=${CHUNK_SIZE}\n`,
      );

      for (const [name, run] of Object.entries(VARIANTS)) {
        const startedAt = performance.now();
        try {
          const result = await run(apiKey, rows);
          const seconds = (performance.now() - startedAt) / 1000;
          console.log(
            `${name.padEnd(38)}${seconds.toFixed(2).padStart(8)}s  requests=${String(result.requests).padStart(3)}  suggestions=${String(result.suggestions).padStart(4)}/${ROW_COUNT}  outputTokens=${result.outputTokens}`,
          );
        } catch (error) {
          const seconds = (performance.now() - startedAt) / 1000;
          console.log(
            `${name.padEnd(38)}${seconds.toFixed(2).padStart(8)}s  FAILED  ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    },
    10 * 60 * 1000,
  );
});
