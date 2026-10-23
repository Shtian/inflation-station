import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type {
  Account,
  DashboardAnalytics,
  DashboardDateRange,
  DashboardPeriod,
} from "./overview-dashboard.types";
import {
  formatDashboardPeriod,
  parseDashboardPeriod,
  previousMonth,
  resolveDashboardPeriod,
} from "./overview-dashboard.utils";

type UseOverviewDashboardResult = {
  accounts: Account[];
  dashboardAccountId: string;
  period: DashboardPeriod;
  dashboardRange: DashboardDateRange;
  today: Date;
  dashboardLoading: boolean;
  dashboardError: string | null;
  dashboardData: DashboardAnalytics | null;
  setDashboardAccountId: (accountId: string) => void;
  selectPeriod: (period: DashboardPeriod) => void;
};

export function useOverviewDashboard(): UseOverviewDashboardResult {
  const navigate = useNavigate();
  const search = useSearch({ from: "/" });
  const [today] = useState(() => new Date());
  const period = parseDashboardPeriod(search.period) ?? previousMonth(today);
  const { startDate: dashboardStartDate, endDate: dashboardEndDate } =
    resolveDashboardPeriod(period, today);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dashboardAccountId, setDashboardAccountId] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardAnalytics | null>(
    null,
  );

  const loadAccounts = useCallback(async () => {
    const response = await fetch("/api/accounts");
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("accounts" in body) ||
      !Array.isArray(body.accounts)
    ) {
      setAccounts([]);
      return;
    }

    if (body.accounts.length === 0) {
      void navigate({ to: "/onboarding", replace: true });
      return;
    }

    const nextAccounts = (body.accounts as Account[]).map((account) => ({
      id: account.id,
      name: account.name,
    }));

    setAccounts(nextAccounts);
  }, [navigate]);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);

    const params = new URLSearchParams();
    if (dashboardAccountId) {
      params.set("accountId", dashboardAccountId);
    }
    if (dashboardStartDate) {
      params.set("startDate", dashboardStartDate);
    }
    if (dashboardEndDate) {
      params.set("endDate", dashboardEndDate);
    }

    const query = params.toString();
    const response = await fetch(
      `/api/dashboard/analytics${query ? `?${query}` : ""}`,
    );
    const body = await response.json().catch(() => null);

    if (!response.ok || !body || typeof body !== "object") {
      setDashboardError("Kunne ikke laste inn data til oversikten.");
      setDashboardData(null);
      setDashboardLoading(false);
      return;
    }

    setDashboardData(body as DashboardAnalytics);
    setDashboardLoading(false);
  }, [dashboardAccountId, dashboardEndDate, dashboardStartDate]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  function selectPeriod(next: DashboardPeriod) {
    void navigate({
      to: "/",
      search: (prev) => ({ ...prev, period: formatDashboardPeriod(next) }),
      replace: true,
    });
  }

  return {
    accounts,
    dashboardAccountId,
    period,
    dashboardRange: {
      startDate: dashboardStartDate,
      endDate: dashboardEndDate,
    },
    today,
    dashboardLoading,
    dashboardError,
    dashboardData,
    setDashboardAccountId,
    selectPeriod,
  };
}
