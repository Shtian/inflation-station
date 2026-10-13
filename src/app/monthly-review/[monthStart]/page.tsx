import { Archivo } from "next/font/google";
import { MonthInReview } from "./month-in-review";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
});

type MonthInReviewPageProps = {
  params: Promise<{
    monthStart: string;
  }>;
  searchParams: Promise<{
    slide?: string | string[];
  }>;
};

export default async function MonthInReviewPage({
  params,
  searchParams,
}: MonthInReviewPageProps) {
  const [{ monthStart }, { slide }] = await Promise.all([params, searchParams]);

  return (
    <main className={archivo.variable}>
      <MonthInReview
        monthStart={monthStart}
        initialSlideId={typeof slide === "string" ? slide : null}
      />
    </main>
  );
}
