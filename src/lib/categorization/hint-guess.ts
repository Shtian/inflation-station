import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import {
  buildProviderErrorDetail,
  isAbortError,
} from "../openai/provider-errors";
import {
  type CategoryMerchantsDb,
  type CategoryProfile,
  getAllCategoryProfiles,
} from "./category-merchants";
import {
  type HintMerchant,
  merchantCore,
  merchantPresence,
  namesAnyMerchant,
  splitHint,
} from "./hint-text";
import { toMerchantFamilyKey } from "./merchant-family";

export const HINT_GUESS_MODEL = "gpt-6-luna";
export const HINT_GUESS_TIMEOUT_MS = 8_000;

const MAX_GUESSES = 6;
const MAX_GUESS_LENGTH = 40;
const OTHER_CATEGORY_LABELS = 6;

export type HintGuess = {
  description: string | null;
  merchants: HintMerchant[];
};

export type HintGuessResult =
  | { status: "ok"; guess: HintGuess }
  | { status: "not_found" }
  | { status: "failed"; reason: "timeout" | "provider_error" };

export type HintGuessDisabledReason = "disabled" | "key_missing";

const hintGuessProviderSchema = z.object({
  description: z.string(),
  similarMerchants: z.array(z.string()),
});

type HintGuessProviderPayload = z.infer<typeof hintGuessProviderSchema>;

const RULES = `You help a user write a classifier hint for one category in their personal finance app. A small model later assigns Norwegian bank transactions to categories, reading "<Category name>: <hint>".
Return:
- description: one short plain-words sentence (max ~70 characters) saying what belongs in the category. Do not repeat the category name. No trailing period. Write the description in English. Do not name any merchant in the description.
- similarMerchants: up to 6 well-known Norwegian merchants or services that fit this category but are NOT already in the history. Use the short brand name as it would appear on a bank statement (e.g. "Rema 1000", "Circle K"). Respect the user's own filing habits shown by the history.
The user's other categories are listed so you can keep this one distinct from look-alikes. Never suggest a merchant that belongs better in another category.`;

export function resolveHintGuessDisabledReason(
  env: Record<string, string | undefined> = process.env,
): HintGuessDisabledReason | null {
  if (env.OPENAI_HINT_SUGGESTIONS_ENABLED?.trim().toLowerCase() === "false") {
    return "disabled";
  }
  return env.OPENAI_API_KEY?.trim() ? null : "key_missing";
}

export async function generateCategoryHintGuess(params: {
  db: CategoryMerchantsDb;
  categoryId: string;
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<HintGuessResult> {
  const profiles = await getAllCategoryProfiles(params.db);
  const target = profiles.find((profile) => profile.id === params.categoryId);
  if (!target) {
    return { status: "not_found" };
  }
  const others = profiles.filter((profile) => profile.id !== target.id);

  const timeoutMs = Math.max(1, params.timeoutMs ?? HINT_GUESS_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const openai = createOpenAI({
      apiKey: params.apiKey,
      fetch: params.fetchImpl ?? fetch,
    });
    const result = await generateObject({
      model: openai.chat(HINT_GUESS_MODEL),
      schema: hintGuessProviderSchema,
      prompt: buildHintGuessPrompt(target, others),
      abortSignal: controller.signal,
      providerOptions: {
        openai: { strictJsonSchema: true, reasoningEffort: "low" },
      },
    });
    return { status: "ok", guess: reconcileHintGuess(result.object, target) };
  } catch (error) {
    console.error("Category hint guess request failed", {
      timeoutMs,
      detail: buildProviderErrorDetail(error),
    });
    return {
      status: "failed",
      reason: isAbortError(error) ? "timeout" : "provider_error",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildHintGuessPrompt(
  target: CategoryProfile,
  others: readonly CategoryProfile[],
): string {
  const labels = (merchants: readonly HintMerchant[]) =>
    merchants.map((merchant) => merchant.label).join(", ") || "(none)";
  const otherLines = others
    .map(
      (other) =>
        `- ${other.name}: ${labels(other.merchants.slice(0, OTHER_CATEGORY_LABELS))}`,
    )
    .join("\n");
  return `${RULES}\n\nCategory: ${target.name} (${target.kind})\nMerchants already in history: ${labels(target.merchants)}\n\nOther categories:\n${otherLines}`;
}

export function reconcileHintGuess(
  payload: HintGuessProviderPayload,
  target: Pick<CategoryProfile, "merchants">,
): HintGuess {
  const merchants: HintMerchant[] = [];
  for (const raw of payload.similarMerchants) {
    if (merchants.length === MAX_GUESSES) {
      break;
    }
    const label = collapseWhitespace(raw);
    if (label.length === 0 || label.length > MAX_GUESS_LENGTH) {
      continue;
    }
    if (splitHint(label).length !== 1) {
      continue;
    }
    const key = toMerchantFamilyKey(label) ?? merchantCore(label);
    if (key.length === 0) {
      continue;
    }
    const matches = (merchant: HintMerchant) =>
      merchant.key === key || merchantPresence(label, merchant) !== "off";
    if (target.merchants.some(matches) || merchants.some(matches)) {
      continue;
    }
    merchants.push({ key, label });
  }

  const description = collapseWhitespace(payload.description).replace(
    /[.!]+$/,
    "",
  );
  return {
    description:
      description.length === 0 ||
      namesAnyMerchant(description, [...target.merchants, ...merchants])
        ? null
        : description,
    merchants,
  };
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
