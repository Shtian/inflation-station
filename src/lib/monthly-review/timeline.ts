import { MonthlyReviewStatus } from "@prisma/client";
import { getMonthlyOverview, type MonthlyOverviewRow } from "./overview";

export const MONTHLY_TIMELINE_REVIEW_STATE = {
  NOT_GENERATED: "NOT_GENERATED",
  GENERATING: "GENERATING",
  GENERATED: "GENERATED",
  FAILED: "FAILED",
} as const;

export type MonthlyTimelineReviewState =
  (typeof MONTHLY_TIMELINE_REVIEW_STATE)[keyof typeof MONTHLY_TIMELINE_REVIEW_STATE];

export type MonthlyTimelineRow = MonthlyOverviewRow & {
  reviewState: MonthlyTimelineReviewState;
  generatedAt: string | null;
  errorMessage: string | null;
  reviewText: string | null;
};

type MonthlyTimelineReviewRecord = {
  monthStart: Date;
  status: MonthlyReviewStatus;
  generatedAt: Date | null;
  errorMessage: string | null;
  reviewText: string | null;
};

type MonthlyReviewMonthOnlyFindManyArgs = {
  select: {
    monthStart: true;
  };
  orderBy: [{ monthStart: "asc" }];
};

type MonthlyReviewTimelineFindManyArgs = {
  select: {
    monthStart: true;
    status: true;
    generatedAt: true;
    errorMessage: true;
    reviewText: true;
  };
  orderBy: [{ monthStart: "asc" }];
};

type MonthlyTimelineDbClient = {
  transaction: {
    findMany: (args: {
      select: {
        id: true;
        bookingDate: true;
        amountNok: true;
        category: {
          select: {
            id: true;
            name: true;
            kind: true;
          };
        };
      };
      orderBy: [{ bookingDate: "asc" }, { id: "asc" }];
    }) => Promise<
      Array<{
        id: string;
        bookingDate: Date;
        amountNok: { toString(): string } | number;
        category: {
          id: string;
          name: string;
          kind: string;
        } | null;
      }>
    >;
  };
  monthlyReview: {
    findMany: (
      args:
        | MonthlyReviewMonthOnlyFindManyArgs
        | MonthlyReviewTimelineFindManyArgs,
    ) => Promise<Array<{ monthStart: Date }> | MonthlyTimelineReviewRecord[]>;
  };
};

function toMonthStartKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");

  return `${year}-${month}-01`;
}

function toReviewState(
  status: MonthlyReviewStatus | null,
): MonthlyTimelineReviewState {
  if (status === MonthlyReviewStatus.GENERATING) {
    return MONTHLY_TIMELINE_REVIEW_STATE.GENERATING;
  }

  if (status === MonthlyReviewStatus.GENERATED) {
    return MONTHLY_TIMELINE_REVIEW_STATE.GENERATED;
  }

  if (status === MonthlyReviewStatus.FAILED) {
    return MONTHLY_TIMELINE_REVIEW_STATE.FAILED;
  }

  return MONTHLY_TIMELINE_REVIEW_STATE.NOT_GENERATED;
}

export async function getMonthlyTimeline(
  db: MonthlyTimelineDbClient,
  options?: { limit?: number },
): Promise<MonthlyTimelineRow[]> {
  const monthlyOverviewDb = {
    transaction: db.transaction,
    monthlyReview: {
      findMany: (args: MonthlyReviewMonthOnlyFindManyArgs) =>
        db.monthlyReview.findMany(args) as Promise<Array<{ monthStart: Date }>>,
    },
  };

  const [overviewRows, reviews] = await Promise.all([
    getMonthlyOverview(monthlyOverviewDb),
    db.monthlyReview.findMany({
      select: {
        monthStart: true,
        status: true,
        generatedAt: true,
        errorMessage: true,
        reviewText: true,
      },
      orderBy: [{ monthStart: "asc" }],
    }) as Promise<MonthlyTimelineReviewRecord[]>,
  ]);

  const reviewByMonthStart = new Map(
    reviews.map((review) => [toMonthStartKey(review.monthStart), review]),
  );

  const rows = overviewRows.map((overviewRow) => {
    const review = reviewByMonthStart.get(overviewRow.monthStart) ?? null;

    return {
      ...overviewRow,
      reviewState: toReviewState(review?.status ?? null),
      generatedAt: review?.generatedAt?.toISOString() ?? null,
      errorMessage: review?.errorMessage ?? null,
      reviewText: review?.reviewText ?? null,
    };
  });

  if (!options?.limit) {
    return rows;
  }

  return rows.slice(0, options.limit);
}
