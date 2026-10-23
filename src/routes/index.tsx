import { createFileRoute } from "@tanstack/react-router";
import { OverviewDashboard } from "@/app/(overview)/overview-dashboard";

export const Route = createFileRoute("/")({
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
