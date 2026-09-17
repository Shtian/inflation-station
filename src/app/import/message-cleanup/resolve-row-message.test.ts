import { describe, expect, it } from "vitest";
import {
  MESSAGE_SOURCE_CLEANED,
  MESSAGE_SOURCE_ORIGINAL,
  type MessageSuggestion,
  resolveRowMessage,
} from "./resolve-row-message";

const PENDING: MessageSuggestion = { status: "pending" };
const CLEANED: MessageSuggestion = { status: "cleaned", text: "Joker Oslo" };

describe("resolveRowMessage", () => {
  it("shows the original message with no cleaned alternative while pending", () => {
    const resolved = resolveRowMessage({
      originalMessage: "JOKER OSLO",
      suggestion: PENDING,
      override: undefined,
    });

    expect(resolved).toEqual({
      source: MESSAGE_SOURCE_ORIGINAL,
      display: "JOKER OSLO",
      originalMessage: "JOKER OSLO",
      hasCleanedAlternative: false,
      cleanedText: null,
    });
  });

  it("moves to the cleaned text on its own once a suggestion lands, with no prior toggle", () => {
    const resolved = resolveRowMessage({
      originalMessage: "JOKER OSLO",
      suggestion: CLEANED,
      override: undefined,
    });

    expect(resolved).toEqual({
      source: MESSAGE_SOURCE_CLEANED,
      display: "Joker Oslo",
      originalMessage: "JOKER OSLO",
      hasCleanedAlternative: true,
      cleanedText: "Joker Oslo",
    });
  });

  it("keeps the original message when toggled before the suggestion lands", () => {
    const beforeLanding = resolveRowMessage({
      originalMessage: "JOKER OSLO",
      suggestion: PENDING,
      override: MESSAGE_SOURCE_ORIGINAL,
    });

    expect(beforeLanding.source).toBe(MESSAGE_SOURCE_ORIGINAL);
    expect(beforeLanding.display).toBe("JOKER OSLO");

    const afterLanding = resolveRowMessage({
      originalMessage: "JOKER OSLO",
      suggestion: CLEANED,
      override: MESSAGE_SOURCE_ORIGINAL,
    });

    expect(afterLanding.source).toBe(MESSAGE_SOURCE_ORIGINAL);
    expect(afterLanding.display).toBe("JOKER OSLO");
  });

  it("keeps the original message when toggled after the suggestion has already landed", () => {
    const resolved = resolveRowMessage({
      originalMessage: "JOKER OSLO",
      suggestion: CLEANED,
      override: MESSAGE_SOURCE_ORIGINAL,
    });

    expect(resolved.source).toBe(MESSAGE_SOURCE_ORIGINAL);
    expect(resolved.display).toBe("JOKER OSLO");
  });

  it("reports no cleaned alternative when the suggestion resolves to none", () => {
    const resolved = resolveRowMessage({
      originalMessage: "RUTER BILLETT",
      suggestion: { status: "none" },
      override: undefined,
    });

    expect(resolved).toEqual({
      source: MESSAGE_SOURCE_ORIGINAL,
      display: "RUTER BILLETT",
      originalMessage: "RUTER BILLETT",
      hasCleanedAlternative: false,
      cleanedText: null,
    });
  });

  it("falls back to the original message when unavailable", () => {
    const resolved = resolveRowMessage({
      originalMessage: "RUTER BILLETT",
      suggestion: { status: "unavailable", reason: "provider_error" },
      override: undefined,
    });

    expect(resolved).toEqual({
      source: MESSAGE_SOURCE_ORIGINAL,
      display: "RUTER BILLETT",
      originalMessage: "RUTER BILLETT",
      hasCleanedAlternative: false,
      cleanedText: null,
    });
  });
});
