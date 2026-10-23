import { createFileRoute } from "@tanstack/react-router";
import { MonthInReview } from "@/app/monthly-review/[monthStart]/month-in-review";
import { MonthInReviewSkeleton } from "@/app/monthly-review/[monthStart]/month-in-review-skeleton";
import { formatMonthHeading } from "@/app/monthly-review/monthly-review-manager.utils";
import archivoCss from "./-archivo.css?url";
import { MonthInReviewError } from "./-components/monthly-review-route-states";
import { getMonthInReviewPage } from "./-server";

function validateSearch(search: Record<string, unknown>): { slide?: string } {
  return typeof search.slide === "string" ? { slide: search.slide } : {};
}

export const Route = createFileRoute("/monthly-review/$monthStart")({
  validateSearch,
  loader: ({ params }) =>
    getMonthInReviewPage({ data: { monthStart: params.monthStart } }),
  staleTime: Number.POSITIVE_INFINITY,
  remountDeps: ({ params }) => params,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Måneden som gikk: ${formatMonthHeading(loaderData.monthStart)} · Inflation Station`
          : "Måneden som gikk · Inflation Station",
      },
    ],
    links: [{ rel: "stylesheet", href: archivoCss }],
  }),
  pendingComponent: MonthInReviewSkeleton,
  errorComponent: MonthInReviewError,
  component: MonthInReviewPage,
});

function MonthInReviewPage() {
  const { monthStart } = Route.useLoaderData();
  const { slide } = Route.useSearch();

  return (
    <main>
      <MonthInReview monthStart={monthStart} initialSlideId={slide ?? null} />
    </main>
  );
}
