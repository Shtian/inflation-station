import { createFileRoute } from "@tanstack/react-router";
import { OverviewDashboard } from "@/app/(overview)/overview-dashboard";
import { parseDashboardPeriod } from "@/app/(overview)/overview-dashboard.utils";

function validateSearch(search: Record<string, unknown>): { period?: string } {
  return typeof search.period === "string" &&
    parseDashboardPeriod(search.period)
    ? { period: search.period }
    : {};
}

export const Route = createFileRoute("/")({
  validateSearch,
  head: () => ({ meta: [{ title: "Oversikt · Inflation Station" }] }),
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <OverviewDashboard />
    </main>
  );
}
