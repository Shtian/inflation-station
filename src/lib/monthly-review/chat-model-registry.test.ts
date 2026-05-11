import { describe, expect, it } from "vitest";
import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL,
  getModelById,
  getModelsByTier,
} from "./chat-model-registry";

describe("chat-model-registry", () => {
  it("resolves a known model by id", () => {
    const model = getModelById("gpt-5.4");

    expect(model.id).toBe("gpt-5.4");
    expect(model.label).toBe("GPT-5.4");
  });

  it("falls back safely for unknown model ids", () => {
    const fallback = getModelById("unknown-model-id");

    expect(fallback.id).toBe(DEFAULT_CHAT_MODEL);
  });

  it("filters models by tier", () => {
    const premiumModels = getModelsByTier("premium");

    expect(premiumModels.length).toBeGreaterThan(0);
    expect(premiumModels.every((model) => model.tier === "premium")).toBe(true);
  });

  it("keeps registry entries unique by model id", () => {
    const ids = CHAT_MODELS.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
