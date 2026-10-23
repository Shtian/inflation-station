export type Account = {
  id: string;
  name: string;
};

export type DashboardRollingPreset = "30d" | "90d" | "ytd";

export type DashboardPeriod =
  | { kind: "month"; year: number; month: number } // month is 1-12
  | { kind: "rolling"; preset: DashboardRollingPreset }
  | { kind: "custom"; startDate: string; endDate: string }; // ISO yyyy-mm-dd

export type DashboardDateRange = { startDate: string; endDate: string };

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
