import { createFileRoute } from "@tanstack/react-router";
import { MonthlyReviewManager } from "@/app/monthly-review/monthly-review-manager";
import {
  MonthlyReviewError,
  MonthlyReviewPending,
} from "./-components/monthly-review-route-states";

export const Route = createFileRoute("/monthly-review/")({
  head: () => ({ meta: [{ title: "Månedsoppsummering · Inflation Station" }] }),
  pendingComponent: MonthlyReviewPending,
  errorComponent: MonthlyReviewError,
  component: MonthlyReviewPage,
});

function MonthlyReviewPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <MonthlyReviewManager />
    </main>
  );
}
