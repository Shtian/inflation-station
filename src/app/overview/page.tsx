import { OverviewDashboard } from "./overview-dashboard";

export default function OverviewPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-zinc-600">
          Track account cashflow and category spending trends.
        </p>
      </div>
      <div className="mt-6">
        <OverviewDashboard />
      </div>
    </main>
  );
}
