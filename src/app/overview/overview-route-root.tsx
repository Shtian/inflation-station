"use client";

import { OverviewDashboard } from "./overview-dashboard";

export function OverviewRouteRoot() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <OverviewDashboard />
    </main>
  );
}
