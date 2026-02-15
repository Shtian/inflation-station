import { SuggestionSource } from "@prisma/client";

type PendingSuggestionRecord = {
  id: string;
  source: SuggestionSource;
  confidence: number | null;
  reasoning: string | null;
  createdAt: Date;
  suggestedCategory: {
    id: string;
    name: string;
  };
  transaction: {
    id: string;
    bookingDate: Date;
    amountNok: { toString(): string } | number;
    normalizedMerchant: string;
    paymentType: string;
    categoryId: string | null;
  };
};

type ReviewQueueDbClient = {
  categorizationSuggestion: {
    findMany(args: {
      where: {
        transaction: {
          categoryId: null;
        };
      };
      select: {
        id: true;
        source: true;
        confidence: true;
        reasoning: true;
        createdAt: true;
        suggestedCategory: {
          select: {
            id: true;
            name: true;
          };
        };
        transaction: {
          select: {
            id: true;
            bookingDate: true;
            amountNok: true;
            normalizedMerchant: true;
            paymentType: true;
            categoryId: true;
          };
        };
      };
      orderBy: [{ createdAt: "desc" }, { id: "asc" }];
    }): Promise<PendingSuggestionRecord[]>;
    deleteMany(args: {
      where: {
        transactionId: {
          in: string[];
        };
      };
    }): Promise<{ count: number }>;
  };
  transaction: {
    findMany(args: {
      where: {
        id: {
          in: string[];
        };
      };
      select: {
        id: true;
        categoryId: true;
      };
    }): Promise<
      Array<{
        id: string;
        categoryId: string | null;
      }>
    >;
    updateMany(args: {
      where: {
        id: string;
        categoryId: null;
      };
      data: {
        categoryId: string;
      };
    }): Promise<{ count: number }>;
  };
  category: {
    findMany(args: {
      where: {
        id: {
          in: string[];
        };
      };
      select: {
        id: true;
      };
    }): Promise<
      Array<{
        id: string;
      }>
    >;
  };
  $transaction<T>(
    fn: (tx: Omit<ReviewQueueDbClient, "$transaction">) => Promise<T>,
  ): Promise<T>;
};

export type PendingCategorizationReview = {
  transaction: {
    id: string;
    bookingDate: string;
    amountNok: number;
    normalizedMerchant: string;
    paymentType: string;
  };
  suggestion: {
    id: string;
    source: SuggestionSource;
    confidence: number | null;
    reasoning: string | null;
    category: {
      id: string;
      name: string;
    };
  };
};

export type CategorizationDecision = {
  transactionId: string;
  categoryId: string;
};

export type SubmitCategorizationReviewResult = {
  updated: number;
  skipped: number;
};

export class CategoryNotFoundError extends Error {
  missingCategoryIds: string[];

  constructor(missingCategoryIds: string[]) {
    super(`Category not found: ${missingCategoryIds.join(", ")}`);
    this.name = "CategoryNotFoundError";
    this.missingCategoryIds = missingCategoryIds;
  }
}

const sourcePriority: Record<SuggestionSource, number> = {
  [SuggestionSource.RULE]: 2,
  [SuggestionSource.OPENAI]: 1,
};

function compareSuggestions(
  a: PendingSuggestionRecord,
  b: PendingSuggestionRecord,
): number {
  const sourceDelta = sourcePriority[b.source] - sourcePriority[a.source];
  if (sourceDelta !== 0) {
    return sourceDelta;
  }

  const confidenceA = a.confidence ?? -1;
  const confidenceB = b.confidence ?? -1;
  if (confidenceB !== confidenceA) {
    return confidenceB - confidenceA;
  }

  const createdAtDelta = b.createdAt.getTime() - a.createdAt.getTime();
  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return a.id.localeCompare(b.id);
}

function toNumber(value: { toString(): string } | number): number {
  return Number.parseFloat(value.toString());
}

export async function listPendingCategorizationReviews(
  db: ReviewQueueDbClient,
): Promise<PendingCategorizationReview[]> {
  const suggestions = await db.categorizationSuggestion.findMany({
    where: {
      transaction: {
        categoryId: null,
      },
    },
    select: {
      id: true,
      source: true,
      confidence: true,
      reasoning: true,
      createdAt: true,
      suggestedCategory: {
        select: {
          id: true,
          name: true,
        },
      },
      transaction: {
        select: {
          id: true,
          bookingDate: true,
          amountNok: true,
          normalizedMerchant: true,
          paymentType: true,
          categoryId: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

  const bestByTransactionId = new Map<string, PendingSuggestionRecord>();
  for (const suggestion of suggestions) {
    const current = bestByTransactionId.get(suggestion.transaction.id);
    if (!current || compareSuggestions(suggestion, current) < 0) {
      bestByTransactionId.set(suggestion.transaction.id, suggestion);
    }
  }

  return [...bestByTransactionId.values()]
    .sort(
      (a, b) =>
        a.transaction.bookingDate.getTime() -
        b.transaction.bookingDate.getTime(),
    )
    .map((entry) => ({
      transaction: {
        id: entry.transaction.id,
        bookingDate: entry.transaction.bookingDate.toISOString().slice(0, 10),
        amountNok: toNumber(entry.transaction.amountNok),
        normalizedMerchant: entry.transaction.normalizedMerchant,
        paymentType: entry.transaction.paymentType,
      },
      suggestion: {
        id: entry.id,
        source: entry.source,
        confidence: entry.confidence,
        reasoning: entry.reasoning,
        category: {
          id: entry.suggestedCategory.id,
          name: entry.suggestedCategory.name,
        },
      },
    }));
}

export async function submitCategorizationReview(
  db: ReviewQueueDbClient,
  decisions: CategorizationDecision[],
): Promise<SubmitCategorizationReviewResult> {
  if (decisions.length === 0) {
    return { updated: 0, skipped: 0 };
  }

  const uniqueByTransactionId = new Map<string, string>();
  for (const decision of decisions) {
    uniqueByTransactionId.set(decision.transactionId, decision.categoryId);
  }

  const dedupedDecisions = [...uniqueByTransactionId.entries()].map(
    ([transactionId, categoryId]) => ({
      transactionId,
      categoryId,
    }),
  );

  const categoryIds = [
    ...new Set(dedupedDecisions.map((item) => item.categoryId)),
  ];
  const categories = await db.category.findMany({
    where: {
      id: {
        in: categoryIds,
      },
    },
    select: {
      id: true,
    },
  });

  const foundCategoryIds = new Set(categories.map((category) => category.id));
  const missingCategoryIds = categoryIds.filter(
    (id) => !foundCategoryIds.has(id),
  );
  if (missingCategoryIds.length > 0) {
    throw new CategoryNotFoundError(missingCategoryIds);
  }

  return db.$transaction(async (tx) => {
    let updated = 0;
    const submittedTransactionIds: string[] = [];

    for (const decision of dedupedDecisions) {
      submittedTransactionIds.push(decision.transactionId);
      const result = await tx.transaction.updateMany({
        where: {
          id: decision.transactionId,
          categoryId: null,
        },
        data: {
          categoryId: decision.categoryId,
        },
      });
      updated += result.count;
    }

    await tx.categorizationSuggestion.deleteMany({
      where: {
        transactionId: {
          in: submittedTransactionIds,
        },
      },
    });

    return {
      updated,
      skipped: dedupedDecisions.length - updated,
    };
  });
}
