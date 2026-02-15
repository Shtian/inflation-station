import { type PaymentType, SuggestionSource } from "@prisma/client";

export type RuleMatchTransaction = {
  id: string;
  normalizedMerchant: string;
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

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function ruleMatchesTransaction(
  transaction: RuleMatchTransaction,
  rule: CategoryRuleCandidate,
): boolean {
  const normalizedNeedle = normalizeToken(rule.merchantContains);

  if (normalizedNeedle.length === 0) {
    return false;
  }

  if (
    !normalizeToken(transaction.normalizedMerchant).includes(normalizedNeedle)
  ) {
    return false;
  }

  return (
    rule.paymentType === null || rule.paymentType === transaction.paymentType
  );
}

function getRuleSpecificity(rule: CategoryRuleCandidate): number {
  return normalizeToken(rule.merchantContains).length;
}

function toSuggestion(
  transactionId: string,
  rule: CategoryRuleCandidate,
): RuleBasedSuggestion {
  const hasPaymentTypeConstraint = rule.paymentType !== null;

  return {
    transactionId,
    suggestedCategoryId: rule.categoryId,
    source: SuggestionSource.RULE,
    confidence: hasPaymentTypeConstraint ? 0.95 : 0.8,
    reasoning: hasPaymentTypeConstraint
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

    suggestions.push(toSuggestion(transaction.id, matchedRule));
  }

  return suggestions;
}
