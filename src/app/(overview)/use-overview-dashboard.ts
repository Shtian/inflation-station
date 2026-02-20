import { useCallback, useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import type {
  Account,
  DashboardAnalytics,
  DashboardRangePreset,
} from "./overview-dashboard.types";
import { getPresetRange, toDateInputValue } from "./overview-dashboard.utils";

type UseOverviewDashboardResult = {
  accounts: Account[];
  dashboardAccountId: string;
  dashboardRangePreset: DashboardRangePreset;
  dashboardStartDate: string;
  dashboardEndDate: string;
  dashboardLoading: boolean;
  dashboardError: string | null;
  dashboardData: DashboardAnalytics | null;
  customDatePopoverOpen: boolean;
  setDashboardAccountId: (accountId: string) => void;
  setDashboardRangePreset: (preset: DashboardRangePreset) => void;
  setDashboardStartDate: (value: string) => void;
  setDashboardEndDate: (value: string) => void;
  setCustomDatePopoverOpen: (open: boolean) => void;
  setDashboardPreset: (preset: Exclude<DashboardRangePreset, "custom">) => void;
  setCustomDateRange: (range: DateRange) => void;
};

export function useOverviewDashboard(): UseOverviewDashboardResult {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dashboardAccountId, setDashboardAccountId] = useState("");
  const [dashboardRangePreset, setDashboardRangePreset] =
    useState<DashboardRangePreset>("all");
  const [dashboardStartDate, setDashboardStartDate] = useState(
    () => getPresetRange("all").startDate,
  );
  const [dashboardEndDate, setDashboardEndDate] = useState(
    () => getPresetRange("all").endDate,
  );
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardAnalytics | null>(
    null,
  );
  const [customDatePopoverOpen, setCustomDatePopoverOpen] = useState(false);

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

    const nextAccounts = (body.accounts as Account[]).map((account) => ({
      id: account.id,
      name: account.name,
    }));

    setAccounts(nextAccounts);
  }, []);

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
      setDashboardError("Could not load dashboard analytics.");
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

  function setDashboardPreset(preset: Exclude<DashboardRangePreset, "custom">) {
    const range = getPresetRange(preset);
    setDashboardRangePreset(preset);
    setDashboardStartDate(range.startDate);
    setDashboardEndDate(range.endDate);
  }

  function setCustomDateRange(range: DateRange) {
    if (!range.from) {
      return;
    }

    setDashboardRangePreset("custom");
    setDashboardStartDate(toDateInputValue(range.from));

    if (range.to) {
      setDashboardEndDate(toDateInputValue(range.to));
      setCustomDatePopoverOpen(false);
      return;
    }

    setDashboardEndDate(toDateInputValue(range.from));
  }

  return {
    accounts,
    dashboardAccountId,
    dashboardRangePreset,
    dashboardStartDate,
    dashboardEndDate,
    dashboardLoading,
    dashboardError,
    dashboardData,
    customDatePopoverOpen,
    setDashboardAccountId,
    setDashboardRangePreset,
    setDashboardStartDate,
    setDashboardEndDate,
    setCustomDatePopoverOpen,
    setDashboardPreset,
    setCustomDateRange,
  };
}
