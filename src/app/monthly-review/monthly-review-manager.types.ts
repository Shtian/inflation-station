export type MonthlyReviewTimelineRow = {
  monthStart: string;
  totalSpendNok: number;
  transactionCount: number;
  topCategory: {
    categoryId: string | null;
    categoryName: string;
    spendNok: number;
  } | null;
  categorySpendBreakdown: Array<{
    categoryId: string | null;
    categoryName: string;
    spendNok: number;
  }>;
  monthOverMonthSpendDeltaNok: number | null;
  reviewState: "NOT_GENERATED" | "GENERATING" | "GENERATED" | "FAILED";
  generatedAt: string | null;
  errorMessage: string | null;
  reviewText: string | null;
};
