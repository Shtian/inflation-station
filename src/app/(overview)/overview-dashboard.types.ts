export type Account = {
  id: string;
  name: string;
};

export type DashboardRangePreset = "all" | "30d" | "90d" | "ytd" | "custom";

export type DashboardAnalytics = {
  netCashflow: Array<{
    date: string;
    netNok: number;
  }>;
  inflowOutflow: Array<{
    date: string;
    inflowNok: number;
    outflowNok: number;
  }>;
  categoryBreakdown: Array<{
    categoryId: string | null;
    categoryName: string;
    spendNok: number;
    transactionCount: number;
  }>;
  accountTrend: Array<{
    accountId: string;
    accountName: string;
    points: Array<{
      date: string;
      netNok: number;
      cumulativeNok: number;
    }>;
  }>;
};
