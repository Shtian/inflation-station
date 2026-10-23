import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { toMonthWindow } from "@/lib/monthly-review/month-in-review";

export const getMonthInReviewPage = createServerFn({ method: "GET" })
  .validator((input: { monthStart: string }) => input)
  .handler(({ data }) => {
    try {
      return { monthStart: toMonthWindow(data.monthStart).monthStart };
    } catch {
      throw notFound();
    }
  });
