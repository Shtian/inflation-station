import { MonthInReview } from "./month-in-review";

type MonthInReviewPageProps = {
  params: Promise<{
    monthStart: string;
  }>;
};

export default async function MonthInReviewPage({
  params,
}: MonthInReviewPageProps) {
  const { monthStart } = await params;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-10">
      <MonthInReview monthStart={monthStart} />
    </main>
  );
}
