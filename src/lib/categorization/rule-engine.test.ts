import { PaymentType, SuggestionSource } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildRuleBasedSuggestions } from "./rule-engine";

describe("buildRuleBasedSuggestions", () => {
  it("returns suggestions for transactions that match merchant and optional payment type constraints", () => {
    const suggestions = buildRuleBasedSuggestions(
      [
        {
          id: "tx-1",
          normalizedMerchant: "rema 1000 oslo",
          paymentType: PaymentType.CARD,
        },
        {
          id: "tx-2",
          normalizedMerchant: "husleie as",
          paymentType: PaymentType.TRANSFER,
        },
      ],
      [
        {
          id: "rule-1",
          categoryId: "cat-groceries",
          merchantContains: "rema",
          paymentType: PaymentType.CARD,
          priority: 10,
        },
        {
          id: "rule-2",
          categoryId: "cat-rent",
          merchantContains: "husleie",
          paymentType: null,
          priority: 20,
        },
      ],
    );

    expect(suggestions).toEqual([
      {
        transactionId: "tx-1",
        suggestedCategoryId: "cat-groceries",
        source: SuggestionSource.RULE,
        confidence: 0.95,
        reasoning: 'Matched merchant "rema" and payment type "CARD".',
      },
      {
        transactionId: "tx-2",
        suggestedCategoryId: "cat-rent",
        source: SuggestionSource.RULE,
        confidence: 0.8,
        reasoning: 'Matched merchant "husleie".',
      },
    ]);
  });

  it("prefers lower priority numbers and then more specific merchant matches", () => {
    const suggestions = buildRuleBasedSuggestions(
      [
        {
          id: "tx-1",
          normalizedMerchant: "coop mega trondheim",
          paymentType: PaymentType.CARD,
        },
      ],
      [
        {
          id: "rule-broad",
          categoryId: "cat-general",
          merchantContains: "coop",
          paymentType: null,
          priority: 10,
        },
        {
          id: "rule-specific",
          categoryId: "cat-grocery",
          merchantContains: "coop mega",
          paymentType: null,
          priority: 10,
        },
      ],
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.suggestedCategoryId).toBe("cat-grocery");
  });

  it("leaves unmatched transactions without a suggestion", () => {
    const suggestions = buildRuleBasedSuggestions(
      [
        {
          id: "tx-1",
          normalizedMerchant: "electric company",
          paymentType: PaymentType.EFT,
        },
      ],
      [
        {
          id: "rule-1",
          categoryId: "cat-grocery",
          merchantContains: "grocery",
          paymentType: PaymentType.CARD,
          priority: 1,
        },
      ],
    );

    expect(suggestions).toEqual([]);
  });
});
