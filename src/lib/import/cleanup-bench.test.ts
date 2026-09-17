import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { describe, it } from "vitest";
import { z } from "zod";
import { buildOpenAiMessageCleanup } from "./openai-message-cleanup";

// Latency benchmark, not an assertion. Skipped unless CLEANUP_BENCH=1 so it
// never runs in CI or `pnpm test:unit`.
//   CLEANUP_BENCH=1 OPENAI_API_KEY=sk-... pnpm exec vitest run src/lib/import/cleanup-bench.test.ts
const ENABLED = process.env.CLEANUP_BENCH === "1";

const MODEL = process.env.BENCH_MODEL ?? "gpt-5.4-nano";
const ROW_COUNT = Number.parseInt(process.env.BENCH_ROWS ?? "300", 10);
const CHUNK_SIZE = Number.parseInt(process.env.BENCH_CHUNK ?? "25", 10);
const CONCURRENCY = Number.parseInt(process.env.BENCH_CONCURRENCY ?? "4", 10);
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

const SUGGESTIONS_SCHEMA = z.object({
  suggestions: z.array(
    z.object({
      rowNumber: z.number().int(),
      cleanedMessage: z.string(),
    }),
  ),
});

// The schema enforces the shape, so the structured prompt drops both the
// "return strict JSON" instruction and the outputFormat example that the
// generateText path needs. Measuring that smaller prompt is part of the point.
const SCHEMA_SYSTEM_PROMPT = "You clean transaction messages.";

function buildSchemaUserPrompt(rows: BenchRow[]): string {
  return JSON.stringify(
    {
      instructions: [
        "Clean and normalize noisy transaction message text.",
        "Do not invent details not present in the original message.",
        "Keep suggestions concise and user-readable.",
        "Return only rows you can improve.",
      ],
      rows,
    },
    null,
    2,
  );
}

async function callOnceStructured(
  apiKey: string,
  rows: BenchRow[],
  providerOptions?: Record<string, Record<string, string>>,
): Promise<CallResult> {
  const openai = createOpenAI({ apiKey });
  const result = await generateObject({
    model: openai.chat(MODEL),
    schema: SUGGESTIONS_SCHEMA,
    maxRetries: 0,
    system: SCHEMA_SYSTEM_PROMPT,
    prompt: buildSchemaUserPrompt(rows),
    providerOptions: {
      openai: { strictJsonSchema: true, ...(providerOptions?.openai ?? {}) },
    },
  });

  return {
    suggestions: result.object.suggestions.length,
    outputTokens: result.usage.outputTokens ?? 0,
  };
}

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

const EFFORT = process.env.BENCH_EFFORT ?? "none";
// "off" omits textVerbosity entirely, so a run can attribute a completeness
// drop to reasoning effort rather than to verbosity.
const VERBOSITY = process.env.BENCH_VERBOSITY ?? "low";
const REASONING = {
  openai: {
    reasoningEffort: EFFORT,
    ...(VERBOSITY === "off" ? {} : { textVerbosity: VERBOSITY }),
  },
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
  call: typeof callOnce = callOnce,
): Promise<VariantResult> {
  const batches = chunk(rows, CHUNK_SIZE);
  const results: CallResult[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
      for (let index = next++; index < batches.length; index = next++) {
        results[index] = await call(apiKey, batches[index], providerOptions);
      }
    }),
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

  "B-single-reduced-reasoning": async (apiKey, rows) => ({
    ...(await callOnce(apiKey, rows, REASONING)),
    requests: 1,
  }),

  "C-parallel-chunks": (apiKey, rows) => runChunked(apiKey, rows),

  "D-parallel-chunks-reduced-reasoning": (apiKey, rows) =>
    runChunked(apiKey, rows, REASONING),

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
    return runChunked(apiKey, unique, REASONING);
  },

  "F-structured-single": async (apiKey, rows) => ({
    ...(await callOnceStructured(apiKey, rows)),
    requests: 1,
  }),

  "G-structured-chunks": (apiKey, rows) =>
    runChunked(apiKey, rows, undefined, callOnceStructured),

  "H-structured-chunks-reduced-reasoning": (apiKey, rows) =>
    runChunked(apiKey, rows, REASONING, callOnceStructured),
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
        `\nmodel=${MODEL} rows=${ROW_COUNT} distinct=${distinct} chunk=${CHUNK_SIZE} conc=${CONCURRENCY} effort=${EFFORT} verbosity=${VERBOSITY}\n`,
      );

      const only = process.env.BENCH_ONLY?.split(",").map((v) => v.trim());
      for (const [name, run] of Object.entries(VARIANTS)) {
        if (only && !only.some((prefix) => name.startsWith(prefix))) {
          continue;
        }
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
