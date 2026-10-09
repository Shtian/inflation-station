import { PaymentType, SuggestionSource } from "@prisma/client";
import { normalizeMerchantKey } from "@/lib/transactions/merchant";

export type RuleMatchTransaction = {
  id: string;
  merchant: string;
  paymentType: PaymentType;
};

export type CategoryRuleCandidate = {
  id: string;
  categoryId: string;
  merchantContains: string;
  paymentType: PaymentType | null;
  priority: number;
};

export type RuleBasedSuggestion = {
  transactionId: string;
  suggestedCategoryId: string;
  source: "RULE";
  confidence: number;
  reasoning: string;
};

// Banks spell one merchant as "REMA 1000" and "REMA1000", or "Café" and "Cafe".
// This stays separate from normalizeMerchantKey because that key is part of the
// dedupe fingerprint of stored transactions.
function toRuleMatchKey(value: string): string {
  return normalizeMerchantKey(
    value.normalize("NFD").replaceAll(/\p{M}/gu, ""),
  ).replaceAll(" ", "");
}

function isPaymentTypeConfirmed(
  transaction: RuleMatchTransaction,
  rule: CategoryRuleCandidate,
): boolean {
  return (
    rule.paymentType !== null && rule.paymentType === transaction.paymentType
  );
}

function ruleMatchesTransaction(
  transaction: RuleMatchTransaction,
  rule: CategoryRuleCandidate,
): boolean {
  const needle = toRuleMatchKey(rule.merchantContains);

  if (
    needle.length === 0 ||
    !toRuleMatchKey(transaction.merchant).includes(needle)
  ) {
    return false;
  }

  // OTHER means the import could not tell how the transaction was paid.
  return (
    rule.paymentType === null ||
    transaction.paymentType === PaymentType.OTHER ||
    isPaymentTypeConfirmed(transaction, rule)
  );
}

function getRuleSpecificity(rule: CategoryRuleCandidate): number {
  return toRuleMatchKey(rule.merchantContains).length;
}

function toSuggestion(
  transaction: RuleMatchTransaction,
  rule: CategoryRuleCandidate,
): RuleBasedSuggestion {
  const paymentTypeConfirmed = isPaymentTypeConfirmed(transaction, rule);

  return {
    transactionId: transaction.id,
    suggestedCategoryId: rule.categoryId,
    source: SuggestionSource.RULE,
    confidence: paymentTypeConfirmed ? 0.95 : 0.8,
    reasoning: paymentTypeConfirmed
      ? `Matched merchant "${rule.merchantContains}" and payment type "${rule.paymentType}".`
      : `Matched merchant "${rule.merchantContains}".`,
  };
}

export function buildRuleBasedSuggestions(
  transactions: RuleMatchTransaction[],
  rules: CategoryRuleCandidate[],
): RuleBasedSuggestion[] {
  if (transactions.length === 0 || rules.length === 0) {
    return [];
  }

  const rankedRules = [...rules].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    const specificityDelta =
      getRuleSpecificity(right) - getRuleSpecificity(left);
    if (specificityDelta !== 0) {
      return specificityDelta;
    }

    return left.id.localeCompare(right.id);
  });

  const suggestions: RuleBasedSuggestion[] = [];

  for (const transaction of transactions) {
    const matchedRule = rankedRules.find((rule) =>
      ruleMatchesTransaction(transaction, rule),
    );

    if (!matchedRule) {
      continue;
    }

    suggestions.push(toSuggestion(transaction, matchedRule));
  }

  return suggestions;
}
