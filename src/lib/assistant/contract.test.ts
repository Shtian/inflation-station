import { describe, expect, it } from "vite-plus/test";
import { readStoredAssistantChatOptions } from "./contract";

const MODELS = {
  availableModels: ["gpt-6-luna", "gpt-6"],
  defaultModelId: "gpt-6-luna",
};

describe("readStoredAssistantChatOptions", () => {
  it("keeps a stored model and effort that are still offered", () => {
    expect(
      readStoredAssistantChatOptions(
        JSON.stringify({ modelId: "gpt-6", reasoningEffort: "high" }),
        MODELS,
      ),
    ).toEqual({ modelId: "gpt-6", reasoningEffort: "high" });
  });

  it("falls back to the default model when the stored one is gone", () => {
    expect(
      readStoredAssistantChatOptions(
        JSON.stringify({ modelId: "gpt-4o", reasoningEffort: "medium" }),
        MODELS,
      ),
    ).toEqual({ modelId: "gpt-6-luna", reasoningEffort: "medium" });
  });

  it.each([
    ["nothing stored", null],
    ["broken JSON", "{"],
    [
      "an unknown effort",
      JSON.stringify({ modelId: "gpt-6", reasoningEffort: "max" }),
    ],
  ])("uses the defaults for %s", (_label, stored) => {
    expect(readStoredAssistantChatOptions(stored, MODELS)).toEqual({
      modelId: "gpt-6-luna",
      reasoningEffort: "none",
    });
  });
});
